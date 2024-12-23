from . import secrets
from .settings import SETTINGS

"""

Connection configurations with defaults for the main DB, auth DB, and redis
Technically only requires a MYSQL_ROOT_PASSWORD to be set.

"""

DB_ENDPOINT = secrets.DB_ENDPOINT or 'mysql'
DB_PASSWORD = secrets.DB_PASSWORD or secrets.MYSQL_ROOT_PASSWORD
DB_USERNAME = secrets.DB_USERNAME or 'root'
DB_PORT = int(secrets.DB_PORT) if secrets.DB_PORT else 3306
DB_TYPE = secrets.DB_TYPE or 'local'  # 'local' or 'deployed' --> changes how app deals with transaction settings
DB_NAME = secrets.DB_NAME or 'learn'

# An auth secret is required in any multi user setup that uses custom auth
if 'auth' in SETTINGS and 'providers' in SETTINGS['auth'] and len(SETTINGS['auth']['providers']) and not ('system' in SETTINGS['auth'] and SETTINGS['auth']['system'] == 'custom'):
    if not secrets.CUSTOM_AUTH_SECRET:
        raise Exception("In order to use auth providers, you must set a CUSTOM_AUTH_SECRET in your .env file.")

CUSTOM_AUTH_SECRET = secrets.CUSTOM_AUTH_SECRET or 'not-a-secret'  # Matched on frontend

CUSTOM_AUTH_DB_ENDPOINT = secrets.CUSTOM_AUTH_DB_ENDPOINT or DB_ENDPOINT
CUSTOM_AUTH_DB_USERNAME = secrets.CUSTOM_AUTH_DB_USERNAME or DB_USERNAME
CUSTOM_AUTH_DB_PASSWORD = secrets.CUSTOM_AUTH_DB_PASSWORD or DB_PASSWORD
CUSTOM_AUTH_DB_PORT = secrets.CUSTOM_AUTH_DB_PASSWORD or DB_PORT
CUSTOM_AUTH_DB_NAME = secrets.CUSTOM_AUTH_DB_NAME or 'custom_auth'

# TODO: make configurable
# The backend process communicates with redis as a message passer; this code configures that connection.
# Note that it uses both the redis protocol (not HTTP) as well as "redis" instead of localhost (due to docker compose)
CELERY_RESULT_BACKEND = "redis://localhost:6379/0"
CELERY_BROKER_URL = "redis://localhost:6379/0"
POOLER_CONNECTION_PARAMS = {
    'host': 'localhost',
    'port': 6379,
    'db': 1,  # Note that this is different from 0, the one used above for celery.
}
