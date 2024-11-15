from sklearn.metrics import pairwise
import numpy as np
from .auth import User
from .exceptions import NoCreateError, RetrieverEmbeddingsError, ZipFileRetrieverError
from .jobs import complete_job, mark_job_error, update_job_progress, store_in_job
from .batch_and_stream_lm import stream_batched_lm, stream_progress_batched_lm
from .prompts.retrieval_prompts import guess_answer_prompt, guess_answer_prompt_backup
import json
import sys
from .integrations.lm import LM, LM_PROVIDERS
from .integrations.file_loaders import get_loader, TextSplitter
from .utils import make_json_serializable, ntokens_to_nchars, get_extension_from_path
import tempfile
import warnings
from .storage_interface import delete_resources, download_file, upload_retriever
import os
import pickle
from .db import needs_special_db, get_db
from .configs.str_constants import APPLIER_RESPONSE
from .configs.user_config import FAST_CHAT_MODEL, DEFAULT_CHAT_MODEL, DEFAULT_EMBEDDING_OPTION
from .utils import remove_ext
from concurrent.futures import ThreadPoolExecutor, as_completed
import math
from difflib import SequenceMatcher
import random
from .prompts.auto_label_prompts import get_auto_desc_system_prompt
from .utils import get_token_estimate, convert_heic_to_jpg
from .integrations.ocr import OCR_PROVIDERS, OCR
from .integrations.embed import EMBED_PROVIDERS, Embed
import time


class Chunk():
    # Embedding is optional
    def __init__(self, index, source_name, txt, embedding=None) -> None:
        self.index = index
        self.source_name = source_name
        self.txt = txt
        self.embedding = embedding
    
    def to_json(self):
        return {
            'index': self.index,
            'source_name': self.source_name,
            'txt': self.txt,
            'embedding': str(self.embedding)  # w/e
        }


# Check of a retriever is consistent wrt its resources and options
def consistency_check(old_res_ret_info, resource_manifest, retriever_options):

    resource_manifest = make_json_serializable(resource_manifest)  # Because resource_manifest might have datetimes, which couldn't be in info.

    # Do they have the same options
    if 'retriever_options' not in old_res_ret_info or 'resource_manifest' not in old_res_ret_info:
        return False
    
    # Has a resource been updated?
    old_res = old_res_ret_info['resource_manifest']
    
    # Is the entry updated whatsoever?
    for k, v in resource_manifest.items():
        if k not in old_res:
            return False
        if old_res[k] != v:
            return False

    needed_comparisons = [
        'chunk_size_tokens',
        'chunk_overlap_tokens',
        'skip_embedding',
        'embedding_fn_code'
    ]
    old_ret_options = old_res_ret_info['retriever_options']
    for k in needed_comparisons:
        if k not in old_ret_options:
            return False
        if k not in retriever_options:
            continue
        if retriever_options[k] != old_ret_options[k]:
            return False

    return True


def _dup_score(chunk1, chunk2, n=6):

    chunk1_split = chunk1.split()
    chunk2_split = chunk2.split()

    while len(chunk1_split) % n != 0:
        chunk1_split.append('')
    while len(chunk2_split) % n != 0:
        chunk2_split.append('')

    chunk1_ngrams = [' '.join(chunk1_split[i:i+n]) for i in range(0, len(chunk1_split)-n)]
    chunk2_ngrams = [' '.join(chunk2_split[i:i+n]) for i in range(0, len(chunk2_split)-n)]

    set1 = set(chunk1_ngrams)
    set2 = set(chunk2_ngrams)
    
    # Use the intersection method of a set to find overlapping elements
    overlapping = set1.intersection(set2)

    # Means some chunks have zero length - not great not terrible
    if len(set1) == 0 and len(set2) == 0:
        return 1

    score = len(overlapping) / max(len(set1), len(set2))
    return score


# Asset level
class Retriever():
    
    def __init__(self, user: User, resources, retriever_type_name="retriever",
                chunk_size_tokens=400, 
                chunk_overlap_tokens=10, lm: LM=LM_PROVIDERS[DEFAULT_CHAT_MODEL],
                embedding_fn_code=None,
                skip_embedding=False, no_create=False, force_ocr=False, force_create=False):

        self.user = user

        self.chunk_size_tokens = chunk_size_tokens
        self.chunk_overlap_tokens = chunk_overlap_tokens
        self.resources = resources
        self.skip_embedding = skip_embedding
        self.retriever_type_name = retriever_type_name
        self.force_ocr = force_ocr
        self.force_ocr = True
        self.force_create = True
        if lm is None:
            lm = LM_PROVIDERS[DEFAULT_CHAT_MODEL]
        self.lm = lm

        # Set embedding function
        # if restore from state, match embedding function
        if embedding_fn_code is None:
            embedding_fn_code = DEFAULT_EMBEDDING_OPTION
        
        if not embedding_fn_code:
            raise Warning("Custom embedding function provided without identifying embedding_fn_code argument")
        self.embedding_fn_code = embedding_fn_code

        self.resource_retrievers = []

        # Create resource retrievers in multi-threaded fashion.
        def create_retriever(res):
            return ResourceRetriever(
                user,
                res,
                chunk_size_tokens=self.chunk_size_tokens,
                chunk_overlap_tokens=self.chunk_overlap_tokens,
                lm=self.lm,
                embedding_fn_code=self.embedding_fn_code,
                skip_embedding=skip_embedding,
                retriever_type_name=self.retriever_type_name,
                no_create=no_create,
                force_ocr=force_ocr,
                force_create=force_create
            )

        self.resource_retrievers = []
        futures = []

        # Initialize ThreadPoolExecutor
        with ThreadPoolExecutor(max_workers=10) as executor:
            try:
                # Schedule retriever creation and get Future objects
                futures = {executor.submit(create_retriever, res): res for res in resources}

                # Collect results as they complete
                for future in as_completed(futures):
                    ret = future.result()  # Will raise an exception if the retriever creation failed
                    self.resource_retrievers.append(ret)

            except:
                """
                
                GPT: If one thread throws an exception while another thread is still executing or hasn't started yet,
                the ThreadPoolExecutor will continue running until all threads are complete or cancelled.
                The except block will only execute after the ThreadPoolExecutor context has exited,
                which means all threads have finished (either successfully or unsuccessfully)
                
                """
                # Clean up if any retriever creation fails
                for ret in self.resource_retrievers:
                    ret.delete()
                raise
        
    # Unfortunately __del__ wasn't getting called automatically at exit
    def delete_resource_retrievers(self):
        for ret in self.resource_retrievers:
            ret.delete()


    def _get_plausible_answers(self, txt):        
        # First, get plausible answers
        prompt = guess_answer_prompt(txt)
        llm_answer_resp = self.lm.run(prompt)

        try:
            answers = json.loads(llm_answer_resp)
        except json.JSONDecodeError:
            prompt = guess_answer_prompt_backup(txt)
            llm_answer_resp = self.lm.run(prompt)
        
        try:
            answers = json.loads(llm_answer_resp)
        except json.JSONDecodeError:
            raise Exception(f"LLM didn't generate json: llm resp='{llm_answer_resp}'")

        return answers


    # Yields each embeddings np array, for each resource
    def _load_embeddings(self):
        for ret in self.resource_retrievers:
            ret: ResourceRetriever
            embeddings = ret.load_embeddings()
            yield embeddings

    def _name_dup_score(self, name1, name2):
        return SequenceMatcher(None, name1, name2).ratio()


    # Get as many chunks as possible given the size of the model
    # Safety ratio = % of context window is ceiling for token estimate
    def max_chunks(self, lm: LM, context="", safety_ratio=.75, use_ends=False):
        all_chunks = []
        chunk_lengths = []
        for chunk in self.get_chunks():
            chunk: Chunk
            all_chunks.append(chunk)
            chunk_length = get_token_estimate(chunk.txt)
            chunk_lengths.append(chunk_length)
        n_tokens = sum(chunk_lengths)
        len_limit = lm.context_length * safety_ratio
        if n_tokens > len_limit:
            if use_ends:
                # Use the beginning and end
                first_half_chunks = []
                second_half_chunks = []
                len_so_far = 0
                for i, chunk in enumerate(all_chunks):
                    if len_so_far + chunk_lengths[i] > len_limit / 2:
                        break
                    else:
                        first_half_chunks.append(chunk)
                        len_so_far += chunk_lengths[i]
                for i in range(len(all_chunks) - 1, -1, -1):
                    if len_so_far + chunk_lengths[i] >= len_limit:
                        break
                    else:
                        second_half_chunks.append(all_chunks[i])
                        len_so_far += chunk_lengths[i]
                all_chunks = first_half_chunks + second_half_chunks[::-1]
            elif context:
                max_results = int((lm.context_length * safety_ratio) // self.chunk_size_tokens)
                all_chunks = self.query(context, max_results=max_results)
            else:
                # Remove random ~difference
                ntok_to_remove = n_tokens - lm.context_length * safety_ratio
                nchunks_to_remove = ntok_to_remove // self.chunk_size_tokens + 1
                while nchunks_to_remove:
                    rand = random.randrange(0, len(all_chunks))
                    del all_chunks[rand]
                    nchunks_to_remove -= 1
        return all_chunks

    def query(self, txt, additional_sources=[],
                additional_source_names=[],
                max_results=5,
                enable_plausible_answers_scheme=False,  # increases time to response by 1 request
                context=[],
                enable_dup_and_diversity_scheme=False,  # can cause major performance issues
                dup_cutoff=.5,
                diversity_reward=1.5):

        assert(len(additional_sources) == len(additional_source_names))

        plausible_answers = []
        if enable_plausible_answers_scheme:
            plausible_answers = self._get_plausible_answers(txt)

        to_embed = [txt] + plausible_answers + context
        embed_obj: Embed = EMBED_PROVIDERS[self.embedding_fn_code]
        query_embeddings = embed_obj.embed(to_embed)

        extra_sources_chunks = [Chunk(-1, additional_source_names[i], additional_sources[i]) for i in range(len(additional_sources))]
        extra_sources_scores = [float('inf') for _ in range(len(extra_sources_chunks))]

        best_chunks = [*extra_sources_chunks]
        best_scores = [*extra_sources_scores]

        for ret in self.resource_retrievers:
            ret: ResourceRetriever
            # a lot of the architecture of the retriever is to avoid this;
            # but unfortunately I think this is the best way, barring improvements to the chunk file.
            # it would be better to rely on mysqlite here or something like that instead. TODO
            chunks_in_memory = [chunk for chunk in ret.get_chunks()]
            if len(chunks_in_memory) == 0:
                continue
            embeddings = [c.embedding for c in chunks_in_memory]
            embeddings = np.array(embeddings)

            try:
                sims = pairwise.cosine_similarity(query_embeddings, embeddings, dense_output=True)
            except:
                raise RetrieverEmbeddingsError("Value error trying to compare embeddings; something went wrong with embeddings.")

            # Assign points for each chunk (for now, just a sum of similarity scores)
            points = np.array(sims[0])  # first one is original question
            for i in range(1, len(sims)):
                points += sims[i] / max(len(sims), 3)  # formula for weighting importance of queries/context

            ranking = points.argsort()[::-1]
            
            # Get the deduplicated top k
            for i, x in enumerate(ranking):
                curr_source: Chunk = chunks_in_memory[x]

                # Check similarity score for diversity
                if enable_dup_and_diversity_scheme:
                    is_duplicate_source = True
                    for s in [x.source_name for x in best_chunks]:
                        if self._name_dup_score(curr_source.source_name, s) > 0.90:
                            is_duplicate_source = False
                    
                    if is_duplicate_source:
                        points[x] *= diversity_reward

                # The 1.5 is thrown in to look out for potential dup score benefits
                if len(best_scores) >= (max_results * 1.5) and best_scores[-1] > points[x]:
                    break

                if enable_dup_and_diversity_scheme:
                    # If it's already in best_chunks, forget it!
                    if any(_dup_score(curr_source.txt, y.txt) > dup_cutoff for y in best_chunks):
                        continue

                # Otherwise, put it in its proper place
                for i in range(len(best_chunks) + 1):
                    if i >= len(best_chunks):  # if we're at the end
                        best_scores.append(points[x])
                        best_chunks.append(curr_source)
                        break
                    if best_scores[i] < points[x]:
                        best_scores.insert(i, points[x])
                        best_chunks.insert(i, curr_source)
                        break

                best_chunks = best_chunks[:max_results]
                best_scores = best_scores[:max_results]
        
        return best_chunks

    # In chunks
    def size(self):
        n = 0
        for ret in self.resource_retrievers:
            ret: ResourceRetriever
            n += ret.size
        return n

    def chunk_names(self):
        names = []
        for ret in self.resource_retrievers:
            ret: ResourceRetriever
            names.extend(ret.chunk_names)
        return names
    
    def chunk_lengths(self):
        lengths = []
        for ret in self.resource_retrievers:
            ret: ResourceRetriever
            lengths.extend(ret.chunk_lengths)
        return lengths
    
    def get_chunks(self):
        for ret in self.resource_retrievers:
            ret: ResourceRetriever
            for chunk in ret.get_chunks():
                yield chunk

    # This isn't used much and should be merged with .query
    def search(self, txt, max_results=5):

        embed_obj: Embed = EMBED_PROVIDERS[self.embedding_fn_code]
        query_embeddings = embed_obj.embed([txt])
        
        embeddings = self._load_embeddings()

        best_chunks = []
        best_scores = []

        for i, ret_embed in enumerate(embeddings):
            sims = pairwise.cosine_similarity(query_embeddings, ret_embed, dense_output=True)
            points = np.array(sims[0])
            ranking = points.argsort()[::-1]

            chosen_indices = ranking[:max_results]
            chunks = self.resource_retrievers[i].get_chunks_by_indices(chosen_indices)

            for k, curr_source in enumerate(chunks):
                for i in range(len(best_chunks) + 1):
                    if i >= len(best_chunks):
                        best_scores.append(points[chosen_indices[k]])
                        best_chunks.append(curr_source)
                        break
                    if best_scores[i] < points[chosen_indices[k]]:
                        best_scores.insert(i, points[chosen_indices[k]])
                        best_chunks.insert(i, curr_source)
                        break

            best_chunks = best_chunks[:max_results]
            best_scores = best_scores[:max_results]

        return best_chunks


    @needs_special_db(consistent_conn=True)
    def apply(self, prompt, prompt_first=False, excerpt_wrapper=lambda x:x, job_id=None, combine_chunks=1, model_code=None, db=None):        
        # Go over each chunk and give a response
        before_prompt = prompt+"\n" if prompt_first else ""
        after_prompt = "\n"+prompt if not prompt_first else ""

        system_prompt = f"Follow these instructions.\n\n{prompt}"
        def get_data():
            for ret in self.resource_retrievers:
                ret: ResourceRetriever
                prompts = []
                for chunk in ret.get_chunks():  # I hope this goes in order :|
                    prompt = f"{before_prompt}{excerpt_wrapper(chunk.txt)}{after_prompt}"
                    prompts.append(prompt)
                    if len(prompts) >= combine_chunks:
                        joined = "".join(prompts)
                        yield {'text': f"{before_prompt}{joined}{after_prompt}", 'sys': system_prompt}
                        prompts = []
                if prompts:
                    joined = "".join(prompts)
                    yield {'text': f"{before_prompt}{joined}{after_prompt}", 'sys': system_prompt}


        # Behavior: if it's a job, yields progress updates.
        # If it's not a job, yields the actual results.

        # Make it a job if there's a job_id, otherwise not

        if job_id:
            db = get_db(consistent_conn=True)
            try:
                size = math.ceil(self.size() / combine_chunks)

                chunk_texts = []
                chunk_names = []
                for chunk in self.get_chunks():
                    chunk_names.append(chunk.source_name)
                    chunk_texts.append(chunk.txt)
                
                def streamingCallback(result, index, _):  # the underscore because we don't use the input data here
                    val = {
                        'chunk_name': chunk_names[index],
                        'instruction': prompt,
                        'chunk_index': index,
                        'chunk_text': chunk_texts[index]
                    }
                    store_in_job(job_id, name=APPLIER_RESPONSE, text_data=result, metadata=val, db=db)

                progress = 0

                real_lm = LM_PROVIDERS[FAST_CHAT_MODEL]
                if model_code:
                    real_lm: LM = LM_PROVIDERS[model_code]

                for i in stream_progress_batched_lm(get_data(), get_lm_part=lambda x: x['text'], get_sys_part=lambda x: x['sys'], streamingCallback=streamingCallback, lm=real_lm):
                    yield i
                    progress += 1
                    update_job_progress(job_id, round(progress/size, 2), db=db)
            
                complete_job(job_id, db=db)

            except:
                print(f"Error ocurred in apply; manually marking.", file=sys.stderr)
                mark_job_error(job_id, db=db)
            finally:
                db.close()
                    
        else:
            for result, _ in stream_batched_lm(get_data()):
                yield result

    # Get n random chunks
    def random(self, max_n):
        reservoir = []
        for i, element in enumerate(self.get_chunks()):
            if i < max_n:
                reservoir.append(element)
            else:
                j = random.randint(0, i)
                if j < max_n:
                    reservoir[j] = element
        return reservoir

    # Used for sending requests the results of which should be an applier/retriever
    # Could potentially add more info
    def info(self):
        # NOTE: When editing here, should probably also edit the ResourceRetriever one as well.
        return {
            'chunk_names': self.chunk_names(),
            'resources': self.resources,
            'chunk_lengths': self.chunk_lengths(),
            'retriever_type_name': self.retriever_type_name,
            'retriever_options':{
                'chunk_size_tokens': self.chunk_size_tokens,
                'chunk_overlap_tokens': self.chunk_overlap_tokens,
                'skip_embedding': self.skip_embedding,
                'embedding_fn_code': self.embedding_fn_code,
                'force_ocr': self.force_ocr
            }
        }
    
    def make_new_desc(self):
        for ret in self.resource_retrievers:
            ret: ResourceRetriever
            ret.make_new_desc()

"""

NOTE: in the future, might make sense to give embeddings their own temp file within ResourceRetriever
That file would be loaded all at once, and the index of an embedding would serve as an index into the more memory efficient chunk file

"""

# Resource level - one file
class ResourceRetriever():
    def __init__(self, user: User, resource_manifest,
                retriever_type_name="retriever",
                chunk_size_tokens=400, 
                chunk_overlap_tokens=10, lm: LM=None,
                embedding_fn_code=None,
                skip_embedding=False, no_create=False,
                force_ocr=False, force_create=False):
        
        self.user = user

        self.retriever_type_name = retriever_type_name
        self.chunk_size_tokens = chunk_size_tokens
        self.chunk_overlap_tokens = chunk_overlap_tokens
        self.lm = lm
        self.resource_manifest = resource_manifest
        self.skip_embedding = skip_embedding
        self.force_ocr = force_ocr

        self.chunk_filename = None
        self.size = 0
        self.chunk_lengths = []
        self.chunk_names = []

        # Set embedding function
        if embedding_fn_code is None:
            embedding_fn_code = DEFAULT_EMBEDDING_OPTION

        if not embedding_fn_code:
            raise Exception("Custom embedding function provided without identifying embedding_fn_code argument")
        
        self.embedding_fn_code = embedding_fn_code

        self._get_or_create_data(no_create=no_create, force_ocr=force_ocr, force_create=force_create)


    # On clean up, get rid of the temporary chunk file
    # Would've been nice to use __del__, but it gets called too early with caching
    def delete(self):
        try:
            if self.chunk_filename:
                os.remove(self.chunk_filename)
        except FileNotFoundError:
            pass

    def _get_or_create_data(self, no_create=False, force_ocr=False, force_create=False):

        # Just use a fresh connection here - this func could be run under different conditions inside the lifetime of the object
        db = get_db(new_connection=True)
        curr = db.cursor()

        if self.chunk_filename:
            try:
                os.remove(self.chunk_filename)
            except:
                pass
            self.chunk_filename = None
        
        res = None
        
        # See if there's an existing retriever out there (type names have to match)

        sql = """
        SELECT * FROM asset_retrieval_storage
        WHERE `resource_id`=%s
        AND JSON_UNQUOTE(JSON_EXTRACT(`metadata`, '$.retriever_type_name')) LIKE %s
        ORDER BY `time_uploaded` DESC
        """

        is_synthetic = self.resource_manifest['id'] == -1
        results = []
        if not is_synthetic:  # if it's synthetic, you're not going to find it!
            curr.execute(sql, (self.resource_manifest['id'], self.retriever_type_name))
            results = curr.fetchall()

        to_del = []
        for ret_row in results:

            """
            Force OCR + Force create = auto delete
            (Force OCR + not force create) OR (not force OCR + force create) = use previous if it used OCR and is consistent
            Not force OCR + Not force create = use if consistent

            """

            # Force create + force ocr deletes all other retrievers
            if force_create and force_ocr:
                to_del.append(ret_row)
                continue

            # OK, we might use previous

            meta = json.loads(ret_row['metadata'])
            my_options = meta['retriever_options']

            if force_ocr or force_create:
                if 'force_ocr' in my_options and my_options['force_ocr']:
                    are_consistent = consistency_check(meta, self.resource_manifest, my_options)
                    if are_consistent:
                        res = ret_row
                        break

                # No OCRd version available / inconsistent + force create
                if force_create:
                    to_del.append(ret_row)
                    continue
            
            if not force_ocr and not force_create:
                are_consistent = consistency_check(meta, self.resource_manifest, my_options)
                if are_consistent:
                    res = ret_row
                    break
                else:
                    to_del.append(ret_row)


        # Delete the bad/old ones...
        if len(to_del) > 0:
            sql = f"""
            DELETE FROM asset_retrieval_storage
            WHERE `resource_id`=%s
            AND JSON_EXTRACT(`metadata`, '$.retriever_type_name') LIKE %s
            AND `id` IN ({','.join([str(x['id']) for x in to_del])})
            """
            curr.execute(sql, (self.resource_manifest['id'], f'"{self.retriever_type_name}"'))
            db.commit(close_cursors=False, close=False)

            delete_resources(to_del)
        
        if res:
            # There's an existing one in storage
            tmp = tempfile.NamedTemporaryFile(delete=False)
            try:
                download_file(tmp.name, res)
                self.chunk_filename = tmp.name
                size = 0
                chunk_lengths = []
                chunk_names = []
                for chunk in self.get_chunks():
                    chunk_lengths.append(len(chunk.txt))
                    chunk_names.append(chunk.source_name)
                    size += 1
                self.size = size
                self.chunk_lengths = chunk_lengths
                self.chunk_names = chunk_names
            except Exception as e:
                print(e, file=sys.stderr)
                print(f"Couldn't load retriever for resource with id {self.resource_manifest['id']}; making instead.", file=sys.stderr)

        # Couldn't load a thing / find a thing
        if not self.chunk_filename:

            if no_create and not is_synthetic:
                raise NoCreateError("Can't find existing chunks, and no_create flag was specified.")

            self.chunk_filename = self._make_chunks(force_ocr=force_ocr, is_synthetic=is_synthetic)
            if not self.skip_embedding and not (is_synthetic and no_create):
                self.chunk_filename = self._embed_chunks()      

            if not is_synthetic:

                # Check if there's an edited description on the asset; if not, try and make one.
                from .asset_actions import has_asset_desc_been_updated
                has_been_edited = has_asset_desc_been_updated(self.resource_manifest['asset_id'], new_conn=True)
                if not has_been_edited:
                    from .worker import task_new_desc
                    task_new_desc.apply_async(args=[pickle.dumps(self)])

                path, res_from = upload_retriever(self.resource_manifest, self.chunk_filename, self.retriever_type_name)

                sql = """
                INSERT INTO asset_retrieval_storage (`asset_id`, `resource_id`, `from`, `path`, `metadata`)
                VALUES (%s, %s, %s, %s, %s)
                """
                meta = self.info()
                curr.execute(sql, (self.resource_manifest['asset_id'], self.resource_manifest['id'], res_from, path, json.dumps(meta)))
            db.commit()


    def get_chunks(self):
        if not self.chunk_filename:
            raise Exception("Tried to use chunk file, but no chunk filename.")

        if not os.path.exists(self.chunk_filename):
            self._get_or_create_data()  # not the greatest... maybe raise an exception?

        with open(self.chunk_filename, 'rb') as fhand:
            i = 0
            while True:
                try:
                    chunk: Chunk = pickle.load(fhand)
                    yield chunk
                    # This loop can be pretty dense in places, and looping over chunks can hog CPU time from the server/other threads, affecting new connections.
                    # the time.sleep(0) gives the server an entry to process new requests before returning here.
                    # If this is a bottleneck, it usually means there are issues in other places that should be fixed
                    # – as of writing, **known related issues have been fixed, and this is probably superfluous.**
                    if i % 20 == 0:
                        time.sleep(0)
                    i += 1
                except EOFError:
                    break


    # Loads embeddings into memory and returns np.array
    # Uses the chunk temp file as serialized pickle file
    def load_embeddings(self):
        embeddings = []

        for chunk in self.get_chunks():
            embedding = chunk.embedding
            if embedding is None:
                raise Exception(f"Trying to load un-embedded chunk in resource {self.resource_manifest['title']} with id {self.resource_manifest['id']}")
            embeddings.append(embedding)
        
        return np.array(embeddings)


    # Encourages batching, which is important performance-wise
    # chunk_indices is a list of chunk_index's
    # The performance here can be improved significantly in the future
    def get_chunks_by_indices(self, chunk_indices):
        # Could use an algorithmic improvement
        chunks = []
        for chunk in self.get_chunks():
            if chunk.index in chunk_indices:
                chunks.append(chunk)
        return chunks


    # Sets self.embeddings to embeddings, matched with chunks
    # Makes a new chunk file that contains the embeddings with each chunk
    def _embed_chunks(self):

        EMBEDDING_BATCH_SIZE = 500

        def _do_embedding(lst):
            embed_obj: Embed = EMBED_PROVIDERS[self.embedding_fn_code]
            embeddings = embed_obj.embed(lst)
            try:
                embeddings = np.array(embeddings)
            except:
                # Probably missed some of the txt and returned empty / wrong-sized vectors in places

                # Find problematic ones
                inds  = []
                max_columns = max(len(row) for row in embeddings)
                for i in range(len(embeddings)):
                    if embeddings[i] is None or len(embeddings[i]) != max_columns:
                        inds.append(i)

                # Retry
                retry_batch = [lst[i] for i in inds]
                retry_embeds = embed_obj.embed(retry_batch)

                # Re-insert problematic ones
                for i, emb in zip(inds, retry_embeds):
                    embeddings[i] = emb
                
                # Give np one more shot (if there's an error, there's an error!)
                embeddings = np.array(embeddings)

            return embeddings

        total = []  # We're storing embeddings all in memory
        batch = []
        for i, chunk in enumerate(self.get_chunks()):
            batch.append(chunk.txt)

            if len(batch) >= EMBEDDING_BATCH_SIZE:
                total.extend(_do_embedding(batch))
                batch = []

        if len(batch) > 0:
            total.extend(_do_embedding(batch))

        # Now we put them in a new chunk file

        new_chunk_file = tempfile.NamedTemporaryFile(delete=False)

        with open(new_chunk_file.name, 'wb') as fhand:
            for i, chunk in enumerate(self.get_chunks()):
                chunk.embedding = total[i]
                pickle.dump(chunk, fhand)
        
        os.remove(self.chunk_filename)
        self.chunk_filename = new_chunk_file
        return new_chunk_file.name

    
    # Returns name of tempfile that stores chunks as pickle
    def _make_chunks(self, force_ocr=False, is_synthetic=False):

        MIN_CHAR_LENGTH_WARN = 100

        text_splitter = TextSplitter(
            max_chunk_size=ntokens_to_nchars(self.chunk_size_tokens),
            chunk_overlap=ntokens_to_nchars(self.chunk_overlap_tokens),
            length_function=len
        )

        self.chunks = []
        self.chunk_names = []
        self.size = 0

        # This little maneuver has an early return
        if is_synthetic:
            text = self.resource_manifest['path']  # for synthetic assets, the path is the text.
            chunk_name = self.resource_manifest['title']
            splitsville = text_splitter.split_text(text)
            
            serialized_file = tempfile.NamedTemporaryFile(delete=False)
            with open(serialized_file.name, 'wb') as ser:
                if not len(splitsville):
                    self.size = 0
                    self.chunk_lengths = []
                    self.chunk_names = []
                    return serialized_file.name
                self.chunk_names = len(splitsville) * [chunk_name]
                for txt in splitsville:
                    chunk = Chunk(self.size, chunk_name, txt)
                    self.chunks.append(chunk)
                    self.size += 1
                    self.chunk_lengths.append(len(txt))
                    pickle.dump(chunk, ser)

                return serialized_file.name

        src = tempfile.NamedTemporaryFile(delete=False)
        download_file(src.name, self.resource_manifest)

        using_name = src.name

        filetype = get_extension_from_path(self.resource_manifest['from'], self.resource_manifest['path'])

        from .user import get_user_ocr_option
        ocr_code = get_user_ocr_option(self.user)
        ocr: OCR = OCR_PROVIDERS[ocr_code]

        def do_ocr(source_name):
            # Choose which OCR provider to use
            try:
                new_filetype = filetype
                if filetype == 'heic':
                    # Need to convert HEIC files
                    new_name = remove_ext(source_name) + '.jpg'
                    convert_heic_to_jpg(source_name, new_name)
                    source_name = new_name
                    new_filetype = "jpg"
                
                return ocr.do_ocr(new_filetype, source_name)
            
            except Exception as e:
                print(f"Something went wrong trying to do OCR with filetype {filetype}: {e}", file=sys.stderr)
                outname = remove_ext(source_name) + '.txt'
                with open(outname, 'w') as f:
                    f.write("(Scanned text not found)")
                if source_name != outname:
                    os.remove(source_name)
                return outname

        attempted_ocr = False
        if force_ocr and filetype in ocr.accept_formats:
            using_name = do_ocr(src.name)
            loader = get_loader(get_extension_from_path(None, using_name), using_name)
            if not loader:
                raise Exception("Could not get loader for OCR'd document")
            attempted_ocr = True
        elif filetype == 'zip':
            raise ZipFileRetrieverError
        else:
            loader = get_loader(filetype, using_name)
            if not loader and filetype in ocr.accept_formats:
                using_name = do_ocr(src.name)
                attempted_ocr = True
                loader = get_loader(get_extension_from_path(None, using_name), using_name)
            if not loader:
                raise Exception(f"File type '{filetype}' not recognized in retriever.")

        # The file we're storing the chunks and stuff in
        serialized_file = tempfile.NamedTemporaryFile(delete=False)
        satisfied = False
        tries = 0
        while not satisfied and tries <= 1:
            tries += 1
            total_char_size = 0
            size = 0
            chunk_names = []
            chunk_lengths = []  # in characters

            data = loader.load_and_split(text_splitter=text_splitter)

            bad_doc = False
            with open(serialized_file.name, 'wb') as ser:
                for i, x in enumerate(data):
                    txt = x.page_content
                    if i < 3:  # Do some checks to see if the file is readable, in the first two chunks.
                        obfuscated = txt.count('�') > ntokens_to_nchars(self.chunk_size_tokens) // 10
                        if obfuscated:
                            bad_doc = True
                            # For PDFs, we can do something about it.
                            break

                    chunk_name = self.resource_manifest['title']

                    page_num = None
                    if 'page' in x.metadata:  # if the loader contains the relevant metadata
                        page_num = x.metadata['page']
                        chunk_name = self.resource_manifest['title'] + f" page {page_num+1}"

                    chunk = Chunk(i, chunk_name, x.page_content)
                    size += 1
                    pickle.dump(chunk, ser)
                    total_char_size += sum(c.isalnum() for c in x.page_content)
                    chunk_lengths.append(len(x.page_content))
                    chunk_names.append(chunk_name)

                chars_per_page = total_char_size / max(len(chunk_names), 1)
                # This approach is used since pages will have a plaintext copyright notice on each page, but that's it.
                if not attempted_ocr and filetype in ocr.accept_formats and (chars_per_page < 300 or bad_doc):
                    print(f"File '{self.resource_manifest['title']}' likely not readable (<300 c/chunk), using OCR if possible.", file=sys.stderr)
                    # For PDFs, we can do something about it.
                    using_name = do_ocr(using_name)
                    loader = get_loader(get_extension_from_path(None, using_name), using_name)
                    attempted_ocr = True
                else:
                    satisfied = True
        
        self.size = size
        self.chunk_lengths = chunk_lengths
        self.chunk_names = chunk_names

        # Get rid of tempfile of resource
        src.close()
        os.remove(using_name)

        if total_char_size < MIN_CHAR_LENGTH_WARN:
            warnings.warn(f"The document {self.resource_manifest['title']} may not be readable; only {total_char_size} characters.")
        
        return serialized_file.name
    
    def make_new_desc(self):
        # Take first 5 chunks
        first_few = []
        for i, chunk in enumerate(self.get_chunks()):
            first_few.append(chunk)
            if i >= 4:
                break
        system_prompt = get_auto_desc_system_prompt(first_few)
        prompt = "Please write the brief description, starting with a verb."
        desc = self.lm.run(prompt, system_prompt=system_prompt)
        # Remove quotes if it starts with quotes
        if desc[0] == '"':
            desc = desc[1:len(desc)-1]
        return desc


    def info(self):
        x = {
            'chunk_names': self.chunk_names,
            'resource_manifest': self.resource_manifest,
            'chunk_lengths': self.chunk_lengths,
            'retriever_type_name': self.retriever_type_name,
            'retriever_options':{
                'chunk_size_tokens': self.chunk_size_tokens,
                'chunk_overlap_tokens': self.chunk_overlap_tokens,
                'skip_embedding': self.skip_embedding,
                'embedding_fn_code': self.embedding_fn_code,
                'force_ocr': self.force_ocr
            }
        }
        return make_json_serializable(x)