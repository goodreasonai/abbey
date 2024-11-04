from .db import get_db, needs_special_db
from .storage_interface import delete_resources
import json
import sys

@needs_special_db(consistent_conn=True)
def mark_job_error(job_id, db=None):
    curr = db.cursor()

    # Remove the temporary data
    sql = """
    DELETE FROM jobs_storage
    WHERE `job_id`=%s
    """
    curr.execute(sql, (job_id,))

    error_json = {'text': "An error occurred."}

    sql = """
    UPDATE jobs
    SET `is_running`=0, `error`=%s
    WHERE `id`=%s
    """
    curr.execute(sql, (json.dumps(error_json), job_id))    


# Mark every job as having an error
# (useful for server reset, for example)
# In the future: should make sure the job is terminated (terminate thread, process, etc.)
def mark_job_error_all():
    db = get_db(new_connection=True)
    jobs = search_for_jobs(limit=1000, is_running=True, db=db)  # one day, you will find this limit here and will think, what idiot did this
    for job in jobs:
        mark_job_error(job['id'], db=db)


def job_error_wrapper(job_id):
    def decorator(func):
        def wrapped(*args, **kwargs):
            try:
                func(*args, **kwargs)
                return True
            except Exception as e:
                print(f"An error occurred while running {func.__name__} with job id {job_id}: {e}", file=sys.stderr)
                mark_job_error(job_id, new_conn=True)
                raise

        return wrapped

    return decorator


# Notice new_conn is True by default - common case in jobs land
@needs_special_db(consistent_conn=True)
def start_job(title: str, metadata: dict, asset_id: int, kind: str, user_id: str=None, db=None):
    job_curr = db.cursor()
    sql = """
    INSERT INTO jobs (`user_id`, `title`, `metadata`, `asset_id`, `progress`, `is_complete`, `is_running`, `kind`)
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    """
    job_curr.execute(sql, (user_id, title, json.dumps(metadata), asset_id, 0, 0, 1, kind))
    job_id = job_curr.lastrowid

    return job_id


# clean_up dictates whether job storage should be removed
@needs_special_db(consistent_conn=True)
def complete_job(job_id, clean_up=False, resource_id=None, db=None):
    curr = db.cursor()
    sql = """
    UPDATE jobs
    SET is_complete=1, is_running=0, progress=1, resource_id=%s
    WHERE `id`=%s
    """
    curr.execute(sql, (resource_id, job_id))

    if clean_up:
        sql = """
        DELETE FROM jobs_storage
        WHERE `job_id`=%s
        """
        curr.execute(sql, (job_id,))

@needs_special_db(consistent_conn=True)
def update_job_progress(job_id, progress, db=None):
    curr = db.cursor()
    sql = """
    UPDATE jobs
    SET `progress`=%s
    WHERE `id`=%s
    """
    curr.execute(sql, (progress, job_id))


@needs_special_db(consistent_conn=True)
def get_job(job_id, asset_id=None, db=None):

    asset_id_text = f"AND `asset_id`={asset_id}" if asset_id else ""
    sql = f"""
    SELECT * FROM jobs
    WHERE `id`=%s {asset_id_text}
    """
    curr = db.cursor()
    curr.execute(sql, (job_id))
    res = curr.fetchone()
    return res


# Returns id of inserted jobs storage item
@needs_special_db(consistent_conn=True)
def store_in_job(job_id, name=None, text_data=None, metadata={}, db=None):

    sql = """
        INSERT INTO jobs_storage (`job_id`, `name`, `text_data`, `metadata`)
        VALUES (%s, %s, %s, %s)
    """
    curr = db.cursor()
    curr.execute(sql, (job_id, name, text_data, json.dumps(metadata)))
    return curr.lastrowid

@needs_special_db(consistent_conn=True)
def clear_job_storage(job_id, name="%", db=None):
    
    curr = db.cursor()
    
    sql = """
        DELETE FROM jobs_storage
        WHERE `job_id`=%s AND `name` LIKE %s
    """
    curr.execute(sql, (job_id, name))
    


def _get_order_by_str(order_by):
    if len(order_by) == 0:
        return ""
    def _make_job_order_by(lst):
        dir_str = "ASC" if lst[-1] else "DESC"
        if len(lst) == 2:
            return  f"`{lst[0]}` {dir_str}"
        elif len(lst) == 3:
            return f"JSON_EXTRACT(`{lst[0]}`, '$.{lst[1]}') {dir_str}"
        else:
            raise Exception(f"Cannot calculate order by for parameter list with length {len(lst)}")
    return "ORDER BY " + ", ".join([_make_job_order_by(x) for x in order_by])


# Lazy!
# Returns tuple of (num results, results generator)
# Order by elements are lists of size 2 or 3, with [column name, (...optional json key), ascending?]
# ---> ex: ['metadata', 'chunk_index', True] --> ORDER BY JSON_EXTRACT(`metadata`, '$.chunk_index') ASC
@needs_special_db(consistent_conn=True, no_close=True)
def get_job_storage(job_id, name="%", order_by=[], db=None):
    curr = db.cursor()

    if len(order_by) > 0:
        if not isinstance(order_by[0], list):
            raise Exception(f"Order by parameter is a list of lists. Instead, you passed: {order_by}")
    
    order_by_str = _get_order_by_str(order_by)

    curr = db.cursor()
    sql = f"""
    SELECT js.*, sub._count
    FROM jobs_storage js
    JOIN (
        SELECT COUNT(*) AS _count 
        FROM jobs_storage 
        WHERE job_id = %s AND IFNULL(name, '') LIKE %s
    ) sub ON 1=1
    WHERE js.job_id = %s AND IFNULL(js.name, '') LIKE %s
    {order_by_str}
    """
    curr.execute(sql, (job_id, name, job_id, name))

    first_res = curr.fetchone()
    
    def row_gen():
        if first_res:
            yield first_res
            while True:
                res = curr.fetchone()
                if not res:
                    break
                yield res

    total = first_res['_count'] if first_res else 0

    return total, row_gen()


# order by uses same rules as above function
@needs_special_db(consistent_conn=True)
def search_for_jobs(kind="%", title="%", asset_id=None, order_by=[], is_running=None, job_id=None, limit=100, offset=0, db=None):
    order_by_str = _get_order_by_str(order_by)
    sql = f"""
    SELECT * FROM jobs
    WHERE IFNULL(`kind`, '') LIKE %s
      AND IFNULL(`title`, '') LIKE %s
      {"AND `asset_id`=%s" if asset_id else ""}
      {"AND `is_running`=%s" if is_running else ""}
      {"AND `id`=%s" if job_id else ""}
    {order_by_str}
    LIMIT %s
    OFFSET %s
    """
    curr = db.cursor()
    args = [kind, title] + ([asset_id] if asset_id else []) + ([is_running] if is_running else []) + ([job_id] if job_id else []) + [limit, offset]
    curr.execute(sql, args)
    results = curr.fetchall()
    return results

@needs_special_db(consistent_conn=True)
def get_job_resource(asset_id, resource_id, db=None):

    sql = """
    SELECT * FROM `asset_resources`
    WHERE `asset_id`=%s AND `id`=%s
    """
    db = get_db()
    curr = db.cursor()
    curr.execute(sql, (asset_id, resource_id))
    res = curr.fetchone()

    return res


@needs_special_db(consistent_conn=True)
def delete_job(asset_id, job_id, db=None):
    curr = db.cursor()
    sql = """
    SELECT * FROM jobs
    WHERE `id`=%s AND `asset_id`=%s
    """
    curr.execute(sql, (job_id, asset_id))
    job = curr.fetchone()

    if not job:
        return False

    # Check if we need to remove something from S3
    if job['resource_id']:
        sql = """
        SELECT * FROM asset_resources
        WHERE `id`=%s
        """
        curr.execute(sql, (job['resource_id'],))
        resource = curr.fetchone()
        delete_resources([resource])

    sql = """
    DELETE FROM jobs
    WHERE `asset_id`=%s AND `id`=%s
    """
    curr.execute(sql, (asset_id, job_id))

    sql = """
    DELETE FROM jobs_storage
    WHERE `job_id`=%s
    """
    curr = db.cursor()
    curr.execute(sql, (job_id,))

    return True