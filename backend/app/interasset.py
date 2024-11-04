from .db import get_db, needs_special_db, ProxyDB
import pickle
import numpy as np
import tempfile
from .storage_interface import download_file, upload_inter_asset_retriever, delete_resources
import sys
from .integrations.embed import EMBED_PROVIDERS, Embed
import os
from sklearn.metrics import pairwise
import hashlib
import json
import random


GROUP_HASH_SIZE = 100

# the pickle file that ends up on s3
class PickledAssets():
    assets: list  # list of asset entries in db
    embeddings: np.array
    embedi_to_asseti: dict  # embedding index in array to asset index in list
    embedding_fn_code: str
    group_hases: list  # hashes of groups of 100 assets (we only check one for consistency)
    group_hash_limit: int
    def __init__(self, assets, embeddings, embedi_to_asseti, group_hashes, group_hash_limit, embedding_fn_code) -> None:
        self.assets = assets
        self.embeddings = embeddings
        self.embedi_to_asseti = embedi_to_asseti
        self.embedding_fn_code = embedding_fn_code
        self.group_hash_limit = group_hash_limit
        self.group_hases = group_hashes



# TODO separate out GroupRetriever from Retriever
class InterAssetRetriever():
    pickled_assets: PickledAssets
    def __init__(self, group_id, new_conn=False, force_create=False) -> None:
        self.group_id = group_id
        self.db = get_db(new_connection=new_conn)
        self.pickled_assets = None
        self.force_create = force_create
        self.embedding_fn_code = "openai-text-embedding-ada-002"
        self._get_or_create()

    def _get_or_create(self):
        
        # Check for existing retriever
        # Unlike with Retriever, if there's a consistency problem, we modify the existing file rather than create from scratch
        # There should only be one, but in case something goes wrong, we do an order by and limit
        sql = """
        SELECT * FROM inter_asset_retrieval_storage
        WHERE `group_id`=%s
        ORDER BY `time_uploaded` DESC
        LIMIT 1
        """
        curr = self.db.cursor()
        curr.execute(sql, (self.group_id,))
        res = curr.fetchone()

        def create(prev_to_del=None):
            fname = self._embed_assets()
            path, res_from = upload_inter_asset_retriever(fname)
            if prev_to_del:
                # Delete previous, in case we're doing a replacement (as for consistency)
                delete_resources([prev_to_del])
                sql = """
                DELETE FROM inter_asset_retrieval_storage
                WHERE `group_id`=%s
                """
                curr.execute(sql, (self.group_id,))
            sql = """
            INSERT INTO inter_asset_retrieval_storage (`group_id`, `from`, `path`)
            VALUES (%s, %s, %s)
            """
            curr.execute(sql, (self.group_id, res_from, path))
            self.db.commit()
            try:
                os.remove(fname)
            except:
                print(f"Failed to remove tempfile {fname}", file=sys.stderr)

        if not res:
            create()
        else:    
            if self.force_create:
                create(prev_to_del=res)
            else:        
                tmp = tempfile.NamedTemporaryFile(delete=False)
                try:
                    download_file(tmp.name, res)
                    with open(tmp.name, 'rb') as fhand:
                        self.pickled_assets = pickle.load(fhand)
                    consistent = self._is_consistent()
                    if not consistent:
                        print("Group retriever found inconsistent; remaking", file=sys.stderr)
                        create(prev_to_del=res)
                    else:
                        curr.close()
                except Exception as e:
                    print(e, file=sys.stderr)

            if not self.pickled_assets:
                print(f"Couldn't load inter asset retriever; making instead.", file=sys.stderr)
                create(prev_to_del=res)



    def _assets_to_hash(self, assets):
        curr_ser = json.dumps(assets, sort_keys=True).encode('utf-8')
        curr_hash = hashlib.sha256(curr_ser).hexdigest()
        return curr_hash

    @needs_special_db(exclusive_conn=True)
    def _is_consistent(self, db: ProxyDB):
        curr = db.cursor()
        # We are doing a random slice
        offseti = random.randrange(0, len(self.pickled_assets.group_hases))
        offset = offseti * self.pickled_assets.group_hash_limit
        sql = """
            SELECT SQL_CALC_FOUND_ROWS `id`, `title`, `author`, `preview_desc` 
            FROM assets
            WHERE `group_id`=%s
            ORDER BY `id` ASC
            LIMIT %s
            OFFSET %s
        """
        curr.execute(sql, (self.group_id, self.pickled_assets.group_hash_limit, offset))
        res = curr.fetchall()
        curr.execute("SELECT FOUND_ROWS() as 'Count'")        
        count = curr.fetchone()['Count']

        if count != len(self.pickled_assets.assets):
            return False

        curr_hash = self._assets_to_hash(res)
        return curr_hash == self.pickled_assets.group_hases[offseti]

    def _embed_assets(self):
        EMBED_BATCH_SIZE = 500
        # This is where security comes into play?
        # And where we're going to need to change in order to accomodate more complicated buckets than single groups
        offset = 0
        # Note that the SELECT has to be the same as in consistency check.
        sql = """
        SELECT `id`, `title`, `author`, `preview_desc`
        FROM assets
        WHERE `group_id`=%s
        ORDER BY `id` ASC
        LIMIT %s
        OFFSET %s
        """
        curr = self.db.cursor()

        total_embeddings = []
        total_assets = []
        embedi_to_asseti = {}

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

        group_hashes = []
        hash_batch = []
        while True:
            curr.execute(sql, (self.group_id, EMBED_BATCH_SIZE, offset))
            results = curr.fetchall()
            if not results or len(results) == 0:
                break

            # What are we embedding?
            # Title + author + preview_desc
            to_embed = []
            for i, res in enumerate(results):
                total_assets.append(res)
                embedi_to_asseti[i + offset] = i + offset  # seems dumb, but recall we may add embeddings in the future for assets, ruining this relationship
                templated = f"{res['title']} by {res['author']}. {res['preview_desc']}"
                to_embed.append(templated)

                hash_batch.append(res)
                if len(hash_batch) >= GROUP_HASH_SIZE:
                    group_hashes.append(self._assets_to_hash(hash_batch))
                    hash_batch = []
            
            embeddings = _do_embedding(to_embed)
            total_embeddings.extend(embeddings)

            offset += EMBED_BATCH_SIZE

        if len(hash_batch):
            group_hashes.append(self._assets_to_hash(hash_batch))

        self.pickled_assets = PickledAssets(total_assets, total_embeddings, embedi_to_asseti, group_hashes, GROUP_HASH_SIZE, embedding_fn_code=self.embedding_fn_code)

        temp = tempfile.NamedTemporaryFile(mode='w+', delete=False)
        with open(temp.name, 'wb') as fhand:
            pickle.dump(self.pickled_assets, fhand)
        return temp.name
    
    def query(self, text, nresults=5):
        if not self.pickled_assets:
            raise Exception("Pickled assets is empty")
        
        embed_obj: Embed = EMBED_PROVIDERS[self.embedding_fn_code]
        query_embeddings = embed_obj.embed([text])

        embeddings = self.pickled_assets.embeddings

        try:
            sims = pairwise.cosine_similarity(query_embeddings, embeddings, dense_output=True)
        except:
            raise Exception("Value error trying to compare embeddings in interasset; something went wrong with embeddings.")

        # Assign points for each chunk (for now, just similarity scores)
        points = np.array(sims[0])  # first one is only one, for now
        ranking = points.argsort()[::-1]

        best_asset_ids = []
        for i, embedi in enumerate(ranking):
            if i >= nresults:
                break
            asseti = self.pickled_assets.embedi_to_asseti[embedi]
            ass = self.pickled_assets.assets[asseti]
            best_asset_ids.append(ass)
        
        return best_asset_ids



