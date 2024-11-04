import math
from .template_response import MyResponse
from .db import get_db, needs_db, needs_special_db
import json
import tempfile
from flask import send_file
import csv
from .batch_and_stream_lm import stream_progress_batched_lm
from .integrations.lm import LM_PROVIDERS
from .storage_interface import upload_asset_file
from .configs.str_constants import *
from .configs.user_config import FAST_CHAT_MODEL
import os
from .jobs import clear_job_storage, complete_job, get_job, get_job_storage, start_job, job_error_wrapper, update_job_progress, store_in_job


# res source - where in the db entry can I find it? Within metadata or at the root?
APPLICATION_DATA = [
    {'res_source': 'metadata', 'index': 'chunk_index', 'name': 'Chunk Index'},
    {'res_source': 'metadata', 'index': 'chunk_name', 'name': 'Chunk Name'},
    {'res_source': 'metadata', 'index': 'instruction', 'name': 'Instruction'},
    {'res_source': '', 'index': 'text_data', 'name': 'Response'},
    {'res_source': 'metadata', 'index': 'chunk_text', 'name': 'Chunk Text'}
]

class Reducer():

    def __init__(self, asset_id, application_id) -> None:
        self.asset_id = asset_id
        self.application_id = application_id

    # Returns file (Flask) response
    @needs_special_db(consistent_conn=True)  # makes sure we close connection in get_job_storage, which is set to no_close
    def append(self, response_type, line_break=0, db=None):
        
        if response_type != 'txt':
            return MyResponse(False, reason=f"Response type {response_type} not implemented").to_json()

        temp_file = tempfile.NamedTemporaryFile(mode='w+', delete=True)

        # Lazy loading of results for appending
        _, results = get_job_storage(self.application_id, order_by=[['metadata', 'chunk_index', True]], db=db)
        for res in results:
            # process each row here
            txt = res['text_data']
            temp_file.write(txt + '\n'*line_break)

        temp_file.seek(0)
        response = send_file(
            temp_file.name,
            as_attachment=True,
            download_name="output.txt",
            mimetype="text/plain"
        )
        response.headers['Access-Control-Expose-Headers'] = 'Content-Disposition'

        @response.call_on_close
        def close_file():
            temp_file.close()

        return response

    # Results should be rows in jobs_storage
    def _write_csv(self, temp_file, results):
        cw = csv.writer(temp_file)

        header_cols = [x['name'] for x in APPLICATION_DATA]

        cw.writerow(header_cols)

        # Lazy loading of results for appending
        for res in results:
            # process each row here
            to_write = []
            for x in APPLICATION_DATA:
                index = x['index']
                source = x['res_source']
                if source == 'metadata':
                    sourced = json.loads(res[source])
                    if index in sourced:
                        entry = sourced[index]
                    else:
                        entry = ""
                elif index not in res:
                    entry = ""
                else:
                    entry = res[index]

                to_write.append(entry)
            cw.writerow(to_write)


    # Returns file response
    def export(self, response_type='csv'):

        if response_type != 'csv':
            raise NotImplementedError(f"Response type {response_type} not implemented.")

        temp_file = tempfile.NamedTemporaryFile(mode='w+', delete=True)

        _, results = get_job_storage(self.application_id)
        self._write_csv(temp_file, results)

        temp_file.seek(0)
        response = send_file(
            temp_file.name,
            as_attachment=True,
            download_name="output.csv",
            mimetype="text/csv"
        )
        response.headers['Access-Control-Expose-Headers'] = 'Content-Disposition'

        @response.call_on_close
        def close_file():
            temp_file.close()

        return response


    # Returns Flask response
    def pairwise(self, job_id, instructions, clean_up_source=False):

        # This is really where the job is spawned.
        @job_error_wrapper(job_id)
        @needs_special_db(consistent_conn=True)
        def do_pairwise(db=None):

            total, _ = get_job_storage(self.application_id, db=db)

            # Once again, burned by the early return :|
            if total < 1:
                raise Exception("No results to process")

            total = sum([math.ceil(total/(2**x)) for x in range(1, math.ceil(math.log2(total)))]+[1])  # :(

            progress = 1
            round_count = 0
            while True:
                
                def get_lm_part(tup):
                    txt = "Given these texts:\n\n"
                    txt += tup[0]['text_data']
                    if tup[1]:
                        txt += "\n\n" + tup[1]['text_data']
                    txt += "\n\nFollow these instructions:"
                    txt += f"\n\n{instructions}"
                    return txt

                def stream_cb(result, index, data):
                    metadata = {
                        'saw': get_lm_part(data)
                    }
                    store_in_job(job_id, name=str(round_count), text_data=result, metadata=metadata)

                def get_data():
                    if round_count == 0:
                        operating_on = "%"
                        operating_id = self.application_id
                    else:
                        operating_on = str(round_count - 1)
                        operating_id = job_id
                    total, results = get_job_storage(operating_id, name=operating_on, db=db)
                    if not total:
                        raise Exception("There were no results!")

                    res1 = None
                    res2 = None
                    for i, res in enumerate(results):
                        if res1:
                            res2 = res
                        else:
                            res1 = res
                        
                        if total % 2 == 1 and i == total - 1:
                            res2 = ""
                        
                        if res1 is not None and res2 is not None:
                            yield res1, res2
                            res1 = None
                            res2 = None
                    
                    if round_count > 0:
                        clear_job_storage(operating_id, name=operating_on, db=db)
                
                this_round_count = 0

                for _ in stream_progress_batched_lm(get_data(), get_lm_part=get_lm_part, streamingCallback=stream_cb, lm=LM_PROVIDERS[FAST_CHAT_MODEL]):
                    this_round_count += 1
                    new_val = round(progress/total, 2)
                    update_job_progress(job_id, new_val, db=db)
                    progress += 1
                
                round_count += 1
                
                if this_round_count == 1 or not this_round_count:
                    break

            return True

        do_pairwise()
            
        # Success!

        db = get_db(consistent_conn=True)
        
        _, results = get_job_storage(job_id, order_by=[['name', False]], db=db)

        # TODO: refactor to use add_resource_from_text
        temp_file = tempfile.NamedTemporaryFile(mode='w+', delete=False)
        
        for res in results:
            temp_file.write(res['text_data'])
            break

        temp_file.close()

        path, from_val = upload_asset_file(self.asset_id, temp_file.name, 'txt')

        os.remove(temp_file.name)

        from .asset_actions import add_asset_resource
        assoc_file_id = add_asset_resource(self.asset_id, 'job_result', from_val, path, None, db=db)

        if clean_up_source:
            clear_job_storage(self.application_id, db=db)
        
        complete_job(job_id, clean_up=True, resource_id=assoc_file_id, db=db)
        
        db.commit(close=True)


    # Returns Flask response
    def transform(self, job_id, instructions, clean_up_source=False):

        # Get the applier results we're acting upon

        @job_error_wrapper(job_id)
        def do_transform():

            db = get_db(new_connection=True)

            total, results = get_job_storage(self.application_id, db=db)

            def cb(result, index, data):
                store_in_job(job_id, text_data=result, metadata=json.loads(data['metadata']), new_conn=True)

            def get_lm_part(x):
                txt = "Given text:\n\n"
                txt += x['text_data']
                txt += "\n\nFollow these instructions:"
                txt += f"\n\n{instructions}"
                return txt

            progress = 1
            for _ in stream_progress_batched_lm(results, get_lm_part=get_lm_part, streamingCallback=cb, lm=LM_PROVIDERS[FAST_CHAT_MODEL]):
                update_job_progress(job_id, round(progress/total, 2), db=db)
                progress += 1

        do_transform()

        db = get_db(new_connection=True)

        total, results = get_job_storage(job_id, db=db)

        temp_file = tempfile.NamedTemporaryFile(mode='w+', delete=False)
        self._write_csv(temp_file, results)
        temp_file.close()

        path, from_val = upload_asset_file(self.asset_id, temp_file.name, 'csv')

        os.remove(temp_file.name)

        from .asset_actions import add_asset_resource
        assoc_file_id = add_asset_resource(self.asset_id, 'job_result', from_val, path, None, db=db)

        if clean_up_source:
            clear_job_storage(self.application_id, db=db)
                    
        complete_job(job_id, clean_up=False, resource_id=assoc_file_id, db=db)

        db.commit()


    @needs_db
    def import_from_csv(self, csv_file, db=None):
        curr = db.cursor()

        sql = f"""
        DELETE FROM jobs_storage
        WHERE `job_id`=%s
        """
        curr.execute(sql, (self.application_id,))

        def decode_lines(file_storage):
            # This will yield each line as a decoded string
            for line in file_storage:
                yield line.decode('utf-8')

        csv_reader = csv.reader(decode_lines(csv_file))

        # Skip header
        next(csv_reader)

        for row in csv_reader:
            try:
                metadata = {x['index']: row[i] for i, x in enumerate(APPLICATION_DATA) if x['res_source'] == 'metadata'}
                root = {x['index']: row[i] for i, x in enumerate(APPLICATION_DATA) if x['res_source'] == ''}
            except IndexError:
                return MyResponse(False, reason="CSV not formatted correctly. Be sure to use a previously exported CSV of results rather than an arbitrary file.").to_json()

            # It used to be that we only executed a query one in every hundred times to reduce database calls
            # Might be worth bringing that functionality back by adding a store_many_in_job function.
            store_in_job(self.application_id, text_data=root['text_data'], metadata=metadata, db=db)

        return MyResponse(True).to_json()
