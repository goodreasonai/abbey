import math

"""

User Configuration

NOTE: None of the values in here are meant to be secret. Secrets are stored in environment variables, which are loaded in secrets.py.
NOTE: These may or may not have to match the frontend config. Take a look there.
NOTE: Variables are organized by how likely a user would consider changing the variable (most to mid to least important).

"""

BACKEND_VERSION = '0.12.6'  # Viewable when a user goes to the root "/" endpoint of the backend


#
#  Most Important Configuration Options
#

APP_NAME = "Abbey"  # Used in certain prompts

# Models and their codes are specified in integrations/lm.py
DEFAULT_CHAT_MODEL = 'gpt-4o-mini'  # The chat model used when a user has none selected, and is the default used in other functions on a case-by-case basis.
HIGH_PERFORMANCE_CHAT_MODEL = 'gpt-4o'  # The model used when a function requires high performance (like generating a curriculum)
BALANCED_CHAT_MODEL = "gpt-4o"  # The model used when a function requires medium smart and medium fast performance
FAST_CHAT_MODEL = 'gpt-4o-mini'  # The model used when speed is the most important factor
LONG_CONTEXT_CHAT_MODEL = 'gpt-4o'  # The model used when a function needs long-context (i.e., >50,000 tokens)
FAST_LONG_CONTEXT_MODEL = 'gpt-4o-mini'  # The model used when speed is important and it also needs long-context
ALT_LONG_CONTEXT_MODEL = 'claude-3-5-sonnet'  # exists to provide some variability in situations where long context makes generations repetitive

DEFAULT_SUBSCRIPTION_CODE = 'free'  # For users that don't have any subscription entries in their user metadata
# Options for user-selected chat models by subscription
SUBSCRIPTION_CODE_TO_MODEL_OPTIONS = {
    'abbey-cathedral': ['gpt-4o', 'claude-3-5-sonnet', 'claude-3-opus', 'gpt-4', 'gpt-4-turbo', 'gpt-4o-mini'],
    'free': ['claude-3-5-sonnet', 'gpt-4o-mini'],
}
LM_ORDER = ['gpt-4o', 'claude-3-5-sonnet', 'claude-3-opus', 'gpt-4', 'gpt-4-turbo', 'gpt-4o-mini']  # Order that a user would see in settings or a dropdown

# The templates that are available to a user with a specific subscription tier
SUBSCRIPTION_CODE_TO_TEMPLATES = {
    'abbey-cathedral': ['document', 'folder', 'detached_chat', 'website', 'classroom', 'curriculum', 'quiz', 'text_editor', 'video', 'notebook', 'inf_quiz', 'section'],
    'free': ['document', 'folder', 'detached_chat', 'website', 'curriculum', 'quiz', 'classroom', 'text_editor', 'video', 'notebook', 'inf_quiz']
}

# Options for optical-character-recognition by subscription tier
# Note that the frontend does not currently exist to allow a user to actually select one, so everyone is on the default
# However, in the future this could be user selected.
DISABLE_OCR = False  # If true, OCR is disabled, which means that DisabledOCR ('disabled') is used for all users (and it accepts nothing, does nothing).
DEFAULT_OCR_OPTION = 'mathpix'  # codes match integrations/ocr.py
SUBSCRIPTION_CODE_TO_OCR_OPTIONS = {
    'abbey-cathedral': ['local', 'mathpix'],
    'free': ['local', 'mathpix']
}

DEFAULT_EMBEDDING_OPTION = "openai-text-embedding-ada-002"  # codes match integrations/embed.py

DEFAULT_STORAGE_OPTION = "s3"  # codes match integrations/file_storage.py

DEFAULT_SEARCH_ENGINE = "bing"  # codes match integrations/web.py
DEFAULT_IMAGE_SEARCH_ENGINE = "bing"  # searching for images

DEFAULT_EMAIL_SERVICE = 'sendgrid'  # codes match integrations/email.py
EMAIL_FROM_NAME = "Abbey"  # The author of auto-generated emails
EMAIL_FROM_ADDRESS = "abbey@us.ai"  # The address from which auto-generated emails are sent
SENDGRID_UNSUB_GROUP = 24624
DISABLE_EMAILS = False  # all calls to send_email return True, but no email gets sent.

# Total limit on assets created by subscription tier
SUBSCRIPTION_CODE_TO_TOTAL_ASSET_LIMITS = {
    'abbey-cathedral':  math.inf,
    'free': 500,
}

# Available text-to-speech models by subscription
SUBSCRIPTION_CODE_TO_TTS_OPTIONS = {
    'abbey-cathedral': ['openai_fable', 'eleven_adam', 'openai_onyx'],
    'free': ['openai_onyx']
}

DEFAULT_TTS_MODEL = 'openai_onyx'  # text-to-speech model used when a user has none selected

AUTH_SYSTEM = "clerk" #  # clerk | custom
CUSTOM_AUTH_USE_DATABASE = False

#
#  Mid-Importance Configuration Options
#

MAX_PDF_PAGES = 250  # SHOULD MATCH FRONTEND - the maximum size of a PDF a user can upload.

MAX_CHAT_RETRIEVER_RESULTS = 7  # When a retriever query is made (without max chunks, or when the full context won't fit in the model), this gives the maximum number of chunks that the query will return in most circumstances. 

RETRIEVER_JOB_TIMEOUT = 30  # in minutes, the max time we'll wait for a retriever to be created (e.g., a document to be processed)

# Domains a user cannot give permissions to on an asset (a user can share with someone@gmail.com, but not all users with a gmail.com email domain – but can give permissions to everyone with a us.ai domain name, or a superspecial.com domain name email.)
ILLEGAL_SHARE_DOMAINS = [
    'gmail.com',
    'hotmail.com',
    'me.com',
    'outlook.com',
    'aol.com',
    'yahoo.com',
    'hotmail.co.uk',
    'msn.com',
    'concast.net',
    'optonline.net'
]

MAX_EMAIL_LIMIT = 500  # The max number of recipients in a single email.
MAX_EMAIL_WAIT = 10  # The number of seconds that needs to go by after a previous email to send a user-action generated email

# The backend process communicates with redis as a message passer; this code configures that connection.
# Note that it uses both the redis protocol (not HTTP) as well as "redis" instead of localhost (due to docker compose)
CELERY_RESULT_BACKEND = "redis://redis:6379/0"
CELERY_BROKER_URL = "redis://redis:6379/0"
POOLER_CONNECTION_PARAMS = {
    'host': 'redis',
    'port': 6379,
    'db': 1,  # Note that this is different from 0, the one used above for celery.
}

#
#  Least Important Configuration Options
#

DEFAULT_PRODUCT_ID = 2  # for backwards compatibility reasons, if a subscription is stored without a product ID, we assign it a product ID of two (which you can make correspond to the correct legacy subscription).

# Controls whether actual permissioning applies or everyone is allowed to see everything
PERMISSIONING = "real"  # "real" | "demo"

# If someone isn't logged in (such as for a demo)
# we can allow users to edit certain templates
OVERRIDE_ALLOWED_TEMPLATES = []  # None | ['temp1', 'temp2']

# Allows users to make an asset available to those without an account / all accounts.
ALLOW_PUBLIC_UPLOAD = True  # NOTE: Should match frontend

#
# For the backend as called by a mobile app frontend
#

MOBILE_FRIENDLY_TEMPLATES = ['document', 'folder', 'detached_chat']  # controls whether these templates show up for mobile users in some backend calls

