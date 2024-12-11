import click
from flask import current_app, g
from .configs.secrets import *
import warnings
from .utils import get_unique_id
from .configs.conn_config import POOLER_CONNECTION_PARAMS
import redis
import json
import time
from functools import wraps


REDIS_TIMEOUT = 30  # in seconds
def exec_via_redis(redis: redis.Redis, options):
    response_key = f"response:{get_unique_id()}"
    options['response_key'] = response_key
    message = json.dumps(options)
    redis.rpush('sql_queue', message)
    receipt = redis.blpop(response_key, timeout=REDIS_TIMEOUT)
    if not receipt:
        raise TimeoutError(f"Redis timeout occurred for command with options:\n {options}")
    message = receipt[1]
    full = json.loads(message)
    if full['error_status']:
        raise Exception(f"Error passed from db pool: {full['error_text']}")
    return full['data']


NO_CALL = {'lastrowid', 'rowcount'}  # these attributes don't return functions, but rather their attribute values, as expected
class PooledCursor():
    id: str
    db_id: str
    def __init__(self, db_id) -> None:
        self.db_id = db_id
        self.id = get_unique_id()
        self.redis = redis.Redis(**POOLER_CONNECTION_PARAMS)
        # Create new cursor
        options = {
            'type': 'new_cursor',
            'name': '',
            'db_id': self.db_id,
            'curr_id': self.id,
            'kwargs': {},
            'args': []
        }
        exec_via_redis(self.redis, options)

    # Forwards curr.functions
    def forward(self, name, *args, **kwargs):
        options = {
            'type': 'cursor_function',
            'name': name,
            'db_id': self.db_id,
            'curr_id': self.id,
            'kwargs': kwargs,
            'args': args
        }
        message = exec_via_redis(self.redis, options)
        return message

    # Get attributes (not functions). Note that these are split up due to the JSON message passing limitations (we couldn't "get" a complex object, like a function).
    def get(self, name):
        options = {
            'type': 'cursor_attribute',
            'name': name,
            'db_id': self.db_id,
            'curr_id': self.id,
            'kwargs': {},
            'args': []
        }
        return exec_via_redis(self.redis, options)
    
    def __getattr__(self, name):
        if name in NO_CALL:
            return self.get(name)

        def method(*args, **kwargs):
            return self.forward(name, *args, **kwargs)
        return method


class PooledConn():
    id: str
    r: redis.Redis
    def __init__(self, consistent_conn=False, exclusive_conn=False) -> None:
        self.id = get_unique_id()
        self.r = redis.Redis(**POOLER_CONNECTION_PARAMS)
        options = {
            'type': 'new_connection',
            'name': '',
            'db_id': self.id,
            'curr_id': None,
            'kwargs': {'consistent': consistent_conn, 'exclusive': exclusive_conn},
            'args': []
        }
        exec_via_redis(self.r, options)

    def close(self):
        options = {
            'type': 'close_connection',
            'name': '',
            'db_id': self.id,
            'curr_id': None,
        }
        exec_via_redis(self.r, options)

    def commit(self):
        options = {
            'type': 'commit',
            'name': '',
            'db_id': self.id,
            'curr_id': None,
            'kwargs': {},
            'args': []
        }
        exec_via_redis(self.r, options)

    def escape_string(self, text):
        options = {
            'type': 'escape_string',
            'name': '',
            'db_id': self.id,
            'curr_id': None,
            'kwargs': {},
            'args': [text]
        }
        return exec_via_redis(self.r, options)


# Every call to get_db returns a new ProxyDB object, which itself (re-)uses a PooledDB redis connection + identity
# It's basically to keep track of cursors so they can be closed.
class ProxyDB():
    pooled_conn: PooledConn
    cursors: list
    def __init__(self, pooled_conn):
        self.pooled_conn = pooled_conn
        self.cursors = []        

    def cursor(self) -> PooledCursor:
        new_cursor = PooledCursor(self.pooled_conn.id)
        self.cursors.append(new_cursor)
        return new_cursor
    
    def escape_string(self, text):
        return self.pooled_conn.escape_string(text)
    
    def close_cursors(self, exempt=[]):
        for curr in self.cursors:
            curr: PooledCursor
            if curr.id not in exempt:
                curr.close()
        self.cursors = [x for x in self.cursors if x.id in exempt]

    def close(self):
        self.close_cursors()
        self.pooled_conn.close()

    def commit(self, close_cursors=True, close=False):
        self.pooled_conn.commit()
        if close:
            self.close()
        elif close_cursors:
            self.close_cursors()


# Wrapper for non-endpoint functions that require use of the db
def needs_db(func):
    @wraps(func)
    def wrapper(*args, db: ProxyDB=None, new_conn=False, exclusive_conn=False, consistent_conn=False, no_commit=False, **kwargs):
        # Close connection iff the connection is fresh
        needs_close = False
        # We want to close cursors, but can't close a calling function's cursors if they are sharing the database
        exempt_cursor_ids = []
        if not db:
            real_db = get_db(new_connection=new_conn, exclusive_conn=exclusive_conn, consistent_conn=consistent_conn)
            needs_close = new_conn or exclusive_conn or consistent_conn  # don't want to close if it's the global connection (g.db)
        else:
            real_db = db
            exempt_cursor_ids.extend([x.id for x in db.cursors])
        try:
            resp = func(*args, db=real_db, **kwargs)
            if not no_commit:
                real_db.commit(close_cursors=False)  # cursors get closed in finally, anyway.
            return resp
        finally:
            # Always close the cursors
            real_db.close_cursors(exempt=exempt_cursor_ids)
            if needs_close:
                real_db.close()
    return wrapper

# If you can figure out how to deduplicate this code with the above, I will give you $20.
def needs_special_db(new_conn=False, exclusive_conn=False, consistent_conn=False, no_close=False):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, db: ProxyDB=None, new_conn=new_conn, exclusive_conn=exclusive_conn, consistent_conn=consistent_conn, no_commit=False, **kwargs):
            # Close connection iff the connection is fresh
            needs_close = False
            # We want to close cursors, but can't close a calling function's cursors if they are sharing the database
            exempt_cursor_ids = []
            if not db:
                real_db = get_db(new_connection=new_conn, exclusive_conn=exclusive_conn, consistent_conn=consistent_conn)
                needs_close = new_conn or exclusive_conn or consistent_conn  # don't want to close if it's the global connection (g.db)
            else:
                real_db = db
                exempt_cursor_ids.extend([x.id for x in db.cursors])
            try:
                resp = func(*args, db=real_db, **kwargs)
                if not no_commit:
                    real_db.commit(close_cursors=False)
                return resp
            finally:
                if not no_close:
                    real_db.close_cursors(exempt=exempt_cursor_ids)
                    if needs_close:
                        real_db.close()
        return wrapper
    return decorator


# A polling lock so that we don't cause delays with the db pool
# TO USER OF THE FUNCTION, APPEARS AS THOUGH IT'S BLOCKING - perhaps poorly named...
@needs_db
def _db_polling_lock(name, db: ProxyDB = None):

    # Two phases for performance
    # We use IS_FREE_LOCK as a pure polling solution
    # And then "poll" using GET_LOCK, which is blocking, but has a short timeout. 
    curr = db.cursor()
    start = time.time()
    timeout = REDIS_TIMEOUT  # Arbitrary
    while True:
        if time.time() - start > timeout:
            return False
        sql = f"SELECT IS_FREE_LOCK('{db.escape_string(name)}') as 'lock';"
        curr.execute(sql)
        res = curr.fetchone()
        if res['lock']:
            break
        else:
            time.sleep(.1)
    
    while True:
        if time.time() - start > timeout:
            return False
        sql = f"SELECT GET_LOCK('{db.escape_string(name)}', .1) as 'lock';"
        curr.execute(sql)
        res = curr.fetchone()
        if res['lock']:
            break
        else:
            time.sleep(.1)

    return True


@needs_db
def _db_release_lock(name, db: ProxyDB = None):
    curr = db.cursor()
    sql = f"SELECT RELEASE_LOCK('{name}');"
    curr.execute(sql)


def with_lock(lock_name, db):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            has_lock = _db_polling_lock(lock_name, db=db)
            
            if not has_lock:
                return None
            
            try:
                result = func(*args, **kwargs)
            finally:
                _db_release_lock(lock_name, db=db)
            
            return result
        return wrapper
    return decorator


def get_db(new_connection=False, consistent_conn=False, exclusive_conn=False) -> ProxyDB:
    try:
        # TODO: consistent connection can have its own global variable
        if new_connection or consistent_conn or exclusive_conn:
            new_conn = PooledConn(consistent_conn=consistent_conn, exclusive_conn=exclusive_conn)
            new_db = ProxyDB(new_conn)
            return new_db
        if 'db' not in g:
            g.db = PooledConn()
        return ProxyDB(g.db)
    except RuntimeError as e:
        # Usually means working outside of application context
        # Typtically undesirable to get here, but in some cases need it
        warnings.warn(f"Tried to use existing connection for database, but RuntimeError occurred: {str(e)}.")
        new_conn = PooledConn()
        return ProxyDB(new_conn)


def init_db():
    db: ProxyDB = get_db()
    curr: PooledCursor = db.cursor()
    with current_app.open_resource('schema.sql') as f:
        curr.execute(f.read().decode('utf8'))
    db.commit()
    curr.close()

@click.command('init-db')
def init_db_command():
    """Clear the existing data and create new tables."""
    init_db()
    click.echo('Initialized the database.')

def init_app(app):
    app.cli.add_command(init_db_command)
