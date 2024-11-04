from .configs.user_config import POOLER_CONNECTION_PARAMS
from .configs.secrets import *
import redis
import pymysql
from pymysql.constants import CLIENT
import sys
import json
from concurrent.futures import ThreadPoolExecutor
import random
from threading import Lock, Timer
from .utils import make_json_serializable
import atexit
from functools import wraps
from queue import Queue, Empty, Full

"""

NOTE: this all runs in a separate process from the rest of the server.

There is NEVER a reason to import any of it into the server.

"""

# Initialize Redis connection
r = redis.Redis(**POOLER_CONNECTION_PARAMS)

# Create the connection pool
db_params = {
    'host': DB_ENDPOINT,
    'user': DB_USERNAME,
    'passwd': DB_PASSWORD,
    'port': DB_PORT,
    'database': DB_NAME,
    'client_flag': CLIENT.MULTI_STATEMENTS,
    'cursorclass': pymysql.cursors.DictCursor
}
N_POOL = 10
N_EXCL = 2

def get_new_conn():
    return pymysql.connect(**db_params)

# We're gonna try to get out of using a lock on this list...
CONNECTIONS = []
CONNECTION_LOCKS = []
# first N_POOL-1 are free; next is for consistent connections; last N_EXCL are for exclusive use
for _ in range(N_POOL + N_EXCL):
    conn = get_new_conn()
    CONNECTIONS.append(conn)
    CONNECTION_LOCKS.append(Lock())

# Exclusive connections
AVAILABLE_EXCL_CONNS = Queue(maxsize=N_EXCL)  # queues are thread safe
for i in range(N_EXCL):
    AVAILABLE_EXCL_CONNS.put(N_POOL + i)

def is_exclusive_lock(db_index):
    return db_index >= N_POOL

ID_TO_CONN_LOCK = Lock()
ID_TO_CONN_INDEX = {}  # btw, this might be a small memory leak, since stuff isn't being taken out.

# Note that every id here has a unique cursor, unlike with connections.
ID_TO_CURR_LOCK = Lock()
ID_TO_CURR = {}  # this is directly to the object and not the cursor because cursors are not provisioned.


# ----------------------------------------------------


LOCK_TIMEOUT = 5  # in seconds, for both DBs and other global variables.

# Acquires lock, gives access to the db object, then gets out of the way
class DB():
    index: int
    db: pymysql.Connection
    lock: Lock
    def __init__(self, index) -> None:
        self.index = index
        self.lock = CONNECTION_LOCKS[self.index]

    def __enter__(self) -> pymysql.Connection:
        if self.lock.acquire(timeout=LOCK_TIMEOUT):
            self.db = CONNECTIONS[self.index]
            return self.db
        else:
            raise Exception(f"Could not acquire lock for new cursor within {LOCK_TIMEOUT} seconds; suspected deadlock.")
            
    def __exit__(self, *_):
        self.lock.release()

    # This should be done with the lock
    def reconnect(self):
        CONNECTIONS[self.index] = get_new_conn()

    
# Something slightly different: since the database locks can be pre-provisioned, it can use ready-made locks.
# Here, however, we need to create and manage locks. This class can only have one (global) object, which is locked (well-enough for python, I think).
class CursorLocks():
    global_lock: Lock
    def __init__(self) -> None:
        self.locks = {}
        self.global_lock = Lock()

    def get_lock(self, cursor_id):
        with self.global_lock:
            if cursor_id not in self.locks:
                self.locks[cursor_id] = Lock()
            return self.locks[cursor_id]
    def lock(self, id):
        return self.get_lock(id)
    
cursor_locks = CursorLocks()


# ----------------------------------------------------


def command_wrapper(func):
    @wraps(func)
    def wrapper(response_key, db_id, *args, **kwargs):
        error_status = False
        error_text = ""
        data = None
        try:
            data = func(db_id, *args, **kwargs)
        except (pymysql.OperationalError, pymysql.InterfaceError) as e:
            try:
                db_index = None
                with ID_TO_CONN_LOCK:
                    db_index = ID_TO_CONN_INDEX[db_id]
                with DB(db_index) as db:
                    db.ping(reconnect=True)
                data = func(db_id, *args, **kwargs) # and then retry the thing
            except Exception as e:
                error_status = True
                error_text = f"Error trying to reconnect: {e}"
        except Exception as e:
            error_status = True
            error_text = f"Exception in db pool ({func}): {repr(e)}. DB ID was: {db_id}. Args were: {args}. Kwargs were: {kwargs}."
        finally:
            r.rpush(response_key, json.dumps({
                'error_status': error_status,
                'error_text': error_text,
                'data': make_json_serializable(data)
            }))  # apparently thread safe

    return wrapper


def release_exclusive_connection(db_id):
    with ID_TO_CONN_LOCK:
        index = ID_TO_CONN_INDEX.pop(db_id, None)
    if index is not None and is_exclusive_lock(index):
        AVAILABLE_EXCL_CONNS.put_nowait(index)


# Not really making a "new" connection, rather just assigning a db_id to something in the pool.
@command_wrapper
def make_new_connection(db_id, kwargs):
    index = random.randrange(0, N_POOL)
    
    if 'read_only' in kwargs:
        # TODO
        pass
    if 'exclusive' in kwargs and kwargs['exclusive']:
        try:
            index = AVAILABLE_EXCL_CONNS.get(timeout=LOCK_TIMEOUT)
        except Empty:
            raise Exception("No available exclusive connections within the timeout period")
        Timer(LOCK_TIMEOUT, release_exclusive_connection, args=[db_id]).start()
    # A consistent new connection always gives the same connection across ProxyDB connections
    elif 'consistent' in kwargs and kwargs['consistent']:
        index = N_POOL - 1

    # give a random connection
    with ID_TO_CONN_LOCK:
        ID_TO_CONN_INDEX[db_id] = index

    return True


@command_wrapper
def close_connection(db_id):
    with ID_TO_CONN_LOCK:
        index = ID_TO_CONN_INDEX[db_id]
    if index is not None:
        if is_exclusive_lock(index):
            release_exclusive_connection(db_id)  # does the popping here
        else:
            with ID_TO_CONN_LOCK:
                ID_TO_CONN_INDEX.pop(db_id)
    return True


@command_wrapper
def make_new_cursor(db_id, curr_id):
    db_index = None
    with ID_TO_CONN_LOCK:
        db_index = ID_TO_CONN_INDEX[db_id]  # Find the appropriate index, so we can get the lock
    
    with DB(db_index) as db:
        curr = db.cursor()
        with ID_TO_CURR_LOCK:
            ID_TO_CURR[curr_id] = curr
    return True


@command_wrapper
def escape_string(db_id, args) -> None:
    db_index = None
    with ID_TO_CONN_LOCK:
        db_index = ID_TO_CONN_INDEX[db_id]  # Find the appropriate index, so we can get the lock
    
    with DB(db_index) as db:
        escaped = db.escape_string(*args)
        
    return escaped


@command_wrapper
def commit_db(db_id) -> None:
    db_index = None
    with ID_TO_CONN_LOCK:
        db_index = ID_TO_CONN_INDEX[db_id]
    with DB(db_index) as db:
        db.commit()
    return True


# 'do_call' arg = this is a function, push the result of the function call to Redis.
@command_wrapper
def use_cursor(db_id, do_call: bool, curr_id, name, args, kwargs) -> None:
    
    db_index = None
    with ID_TO_CONN_LOCK:
        db_index = ID_TO_CONN_INDEX[db_id]  # Find the appropriate index, so we can get the lock
    
    result = None
    with DB(db_index):  # We have the lock for the connection
        curr_lock = cursor_locks.get_lock(curr_id)  # Find the appropriate cursor lock
        with curr_lock:  # We have the lock for the cursor
            curr = None
            with ID_TO_CURR_LOCK:
                curr = ID_TO_CURR[curr_id]
            attr = getattr(curr, name)
            if do_call:
                result = attr(*args, **kwargs)
            else:
                result = attr
            # If we're closing the cursor, also remove it from ID_TO_CURR
            if name == 'close':
                with ID_TO_CURR_LOCK:
                    del ID_TO_CURR[curr_id]

            
    return result

# ----------------------------------------------------

def clean_up():
    for curr in ID_TO_CURR.values():
        try:
            curr.close()
        except:
            pass
    for conn in CONNECTIONS:
        conn: pymysql.Connection
        try:
            conn.close()
        except:
            pass

atexit.register(clean_up)


# ----------------------------------------------------

    
# Initialize MySQL Connection Pool
def listen_for_commands():
    print("The db pooler is listening...")
    MAX_THREADS = 10
    with ThreadPoolExecutor(max_workers=MAX_THREADS) as executor:
        while True:
            try:
                _, message = r.blpop('sql_queue')  # blocking
                command = json.loads(message)
                command_type = command['type']
                command_name = command['name']
                args = command.get('args', [])
                kwargs = command.get('kwargs', {})
                db_id = command['db_id']
                curr_id = command['curr_id']
                response_key = command['response_key']

                if command_type == 'new_connection':
                    executor.submit(make_new_connection, response_key, db_id, kwargs)
                elif command_type == 'close_connection':
                    executor.submit(close_connection, response_key, db_id)
                elif command_type == 'new_cursor':
                    executor.submit(make_new_cursor, response_key, db_id, curr_id)
                elif command_type == 'commit':
                    executor.submit(commit_db, response_key, db_id)
                elif command_type == 'escape_string':
                    executor.submit(escape_string, response_key, db_id, args)
                elif command_type == 'cursor_function':
                    executor.submit(use_cursor, response_key, db_id, True, curr_id, command_name, args, kwargs)
                elif command_type == 'cursor_attribute':
                    executor.submit(use_cursor, response_key, db_id, False, curr_id, command_name, args, kwargs)
            except Exception as e:
                print(f"Exception occurred in DB pooler main loop: {e}", file=sys.stderr)

listen_for_commands()
