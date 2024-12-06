import math
from .secrets import (
    OPENAI_API_KEY, ANTHROPIC_API_KEY, ELEVEN_LABS_API_KEY, MATHPIX_API_APP, MATHPIX_API_KEY, BING_API_KEY, 
    AWS_SECRET_KEY, AWS_ACCESS_KEY, SENDGRID_API_KEY, SMTP_EMAIL, SMTP_PASSWORD, SMTP_PORT, SMTP_SERVER,
    CLERK_JWT_PEM, CLERK_SECRET_KEY, CUSTOM_AUTH_SECRET, CUSTOM_AUTH_DB_ENDPOINT, CUSTOM_AUTH_DB_USERNAME, CUSTOM_AUTH_DB_PASSWORD, CUSTOM_AUTH_DB_PORT, CUSTOM_AUTH_DB_NAME,
    BING_API_KEY, OLLAMA_URL, OPENAI_COMPATIBLE_URL, SEARXNG_URL
)
from ..integrations.lm import gen_ollama_lms, gen_openai_compatible_lms
from ..integrations.embed import gen_ollama_embeds, gen_openai_compatible_embeds
from ..integrations.tts import gen_openai_compatible_tts
from ..integrations.web import gen_searxng_engines
import os
import json

"""

User Configuration

NOTE: None of the values in here are meant to be secret. Secrets are stored in environment variables, which are loaded in secrets.py.
NOTE: These may or may not have to match the frontend config. Take a look there.
NOTE: Variables are organized by how likely a user would consider changing the variable (most to mid to least important).

"""

BACKEND_VERSION = '0.12.7'  # Viewable when a user goes to the root "/" endpoint of the backend

AVAILABLE_PROVIDERS = {
    'openai': True if OPENAI_API_KEY else False,
    'anthropic': True if ANTHROPIC_API_KEY else False,
    'eleven-labs': True if ELEVEN_LABS_API_KEY else False,
    'ollama': True if OLLAMA_URL else False,
    'openai-compatible': True if OPENAI_COMPATIBLE_URL else False,
    'bing': True if BING_API_KEY else False,
    'searxng': True if SEARXNG_URL else False
}

# Enabled models by provider profile
AVAILABLE_LMS = {
    'openai': ['gpt-4o', 'gpt-4o-mini', 'gpt-4', 'gpt-4-turbo'],
    'anthropic': ['claude-3-5-sonnet', 'claude-3-opus'],
    'ollama': [x.code for x in gen_ollama_lms()],
    'openai-compatible': [x.code for x in gen_openai_compatible_lms()]
}

AVAILABLE_TTS = {
    'openai': ['openai_fable', 'openai_onyx'],
    'eleven-labs': ['eleven_adam'],
    'openai-compatible': [x.code for x in gen_openai_compatible_tts()]
}

AVAILABLE_EMBED = {
    'openai': ['openai-text-embedding-ada-002', 'openai-text-embedding-3-small'],
    'ollama': [x.code for x in gen_ollama_embeds()],
    'openai-compatible': [x.code for x in gen_openai_compatible_embeds()]
}

AVAILABLE_SEARCH = {
    'bing': ['bing'],
    'searxng': [x.code for x in gen_searxng_engines()],
}

AVAILABLE_TEMPLATES = ['document', 'folder', 'detached_chat', 'website', 'classroom', 'curriculum', 'quiz', 'text_editor', 'video', 'notebook', 'inf_quiz', 'section']  # could use the list in templates.py, but want to avoid imports here.

# real default chat model will be the one that's available
DEFAULT_CHAT_MODEL_RANKINGS = ['gpt-4o-mini', 'claude-3-5-sonnet']  # The chat model used when a user has none selected, and is the default used in other functions on a case-by-case basis.
HIGH_PERFORMANCE_CHAT_MODEL_RANKINGS = ['gpt-4o', 'claude-3-5-sonnet']  # The model used when a function requires high performance (like generating a curriculum)
BALANCED_CHAT_MODEL_RANKINGS = ['gpt-4o', 'claude-3-5-sonnet']  # The model used when a function requires medium smart and medium fast performance
FAST_CHAT_MODEL_RANKINGS = ['gpt-4o-mini', 'claude-3-5-sonnet']  # The model used when speed is the most important factor
LONG_CONTEXT_CHAT_MODEL_RANKINGS = ['gpt-4o', 'claude-3-5-sonnet']  # The model used when a function needs long-context (i.e., >50,000 tokens)
FAST_LONG_CONTEXT_MODEL_RANKINGS = ['gpt-4o-mini', 'claude-3-5-sonnet']  # The model used when speed is important and it also needs long-context
ALT_LONG_CONTEXT_MODEL_RANKINGS = LONG_CONTEXT_CHAT_MODEL_RANKINGS[::-1]  # exists to provide some variability in situations where long context makes generations repetitive

EMBEDDING_MODEL_RANKINGS = ['openai-text-embedding-ada-002', 'openai-text-embedding-3-small', *[x.code for x in gen_ollama_embeds()], *[x.code for x in gen_openai_compatible_embeds()]]

SEARCH_RANKINGS = ['bing', 'searxng']

def get_available(provider_map):
    return sum([y for x, y in provider_map.items() if AVAILABLE_PROVIDERS[x]], [])  # neat trick, no?

def get_highest_ranked_available(rankings, provider_map):
    all_available = get_available(provider_map)
    for model in rankings:
        if model in all_available:
            return model
    available = get_available(provider_map)
    if len(available):
        return available[0]
        
    return ""

# This extra ranking is done so that a user sees a consistent / sensible ordering of LM options
LM_RANKINGS = ['gpt-4o', 'claude-3-5-sonnet', 'claude-3-opus', 'gpt-4', 'gpt-4-turbo', 'gpt-4o-mini', *[x.code for x in gen_ollama_lms()], *[x.code for x in gen_openai_compatible_lms()]]
LM_ORDER = [x for x in LM_RANKINGS if x in get_available(AVAILABLE_LMS)]  # Order that a user would see in settings or a dropdown

#
#  Most Important Configuration Options
#

APP_NAME = "Abbey"  # Used in certain prompts

# Models and their codes are specified in integrations/lm.py
DEFAULT_CHAT_MODEL = get_highest_ranked_available(DEFAULT_CHAT_MODEL_RANKINGS, AVAILABLE_LMS)
HIGH_PERFORMANCE_CHAT_MODEL = get_highest_ranked_available(HIGH_PERFORMANCE_CHAT_MODEL_RANKINGS, AVAILABLE_LMS)
BALANCED_CHAT_MODEL = get_highest_ranked_available(BALANCED_CHAT_MODEL_RANKINGS, AVAILABLE_LMS)
FAST_CHAT_MODEL = get_highest_ranked_available(FAST_CHAT_MODEL_RANKINGS, AVAILABLE_LMS)
LONG_CONTEXT_CHAT_MODEL = get_highest_ranked_available(LONG_CONTEXT_CHAT_MODEL_RANKINGS, AVAILABLE_LMS)
FAST_LONG_CONTEXT_MODEL = get_highest_ranked_available(FAST_LONG_CONTEXT_MODEL_RANKINGS, AVAILABLE_LMS)
ALT_LONG_CONTEXT_MODEL = get_highest_ranked_available(ALT_LONG_CONTEXT_MODEL_RANKINGS, AVAILABLE_LMS)

DEFAULT_EMBEDDING_OPTION = get_highest_ranked_available(EMBEDDING_MODEL_RANKINGS, AVAILABLE_EMBED)

DEFAULT_SUBSCRIPTION_CODE = 'free'  # For users that don't have any subscription entries in their user metadata
# Options for user-selected chat models by subscription

_SUB_TO_MODELS = os.environ.get('SUBSCRIPTION_CODE_TO_MODEL_OPTIONS')
SUBSCRIPTION_CODE_TO_MODEL_OPTIONS = json.loads(_SUB_TO_MODELS) if _SUB_TO_MODELS else {DEFAULT_SUBSCRIPTION_CODE: get_available(AVAILABLE_LMS)}

# The templates that are available to a user with a specific subscription tier
_SUB_TO_TEMPLATES = os.environ.get('SUBSCRIPTION_CODE_TO_TEMPLATES')
SUBSCRIPTION_CODE_TO_TEMPLATES = json.loads(_SUB_TO_TEMPLATES) if _SUB_TO_TEMPLATES else {DEFAULT_SUBSCRIPTION_CODE: AVAILABLE_TEMPLATES}

# Options for optical-character-recognition by subscription tier
# Note that the frontend does not currently exist to allow a user to actually select one, so everyone is on the default
# However, in the future this could be user selected – once there are more options available.
DISABLE_OCR = not (MATHPIX_API_APP and MATHPIX_API_KEY)  # If true, OCR is disabled, which means that DisabledOCR ('disabled') is used for all users (and it accepts nothing, does nothing).
DEFAULT_OCR_OPTION = 'mathpix'  # codes match integrations/ocr.py

DEFAULT_STORAGE_OPTION = "s3" if AWS_ACCESS_KEY and AWS_SECRET_KEY else "local"  # codes match integrations/file_storage.py

_SUB_TO_SEARCH = os.environ.get('SUBSCRIPTION_CODE_TO_SEARCH_OPTIONS')
SUBSCRIPTION_CODE_TO_SEARCH_OPTIONS = json.loads(_SUB_TO_SEARCH) if _SUB_TO_SEARCH else {DEFAULT_SUBSCRIPTION_CODE: get_available(AVAILABLE_SEARCH)}
DEFAULT_SEARCH_ENGINE = get_highest_ranked_available(SEARCH_RANKINGS, AVAILABLE_SEARCH)

DEFAULT_EMAIL_SERVICE = 'sendgrid' if SENDGRID_API_KEY else 'smtp'  # codes match integrations/email.py
EMAIL_FROM_NAME = "Abbey"  # The author of auto-generated emails
EMAIL_FROM_ADDRESS = os.environ.get('SENDGRID_EMAIL') if DEFAULT_EMAIL_SERVICE == 'sendgrid' else SMTP_EMAIL  # The address from which auto-generated emails are sent
SENDGRID_UNSUB_GROUP = int(os.environ.get('SENDGRID_UNSUB_GROUP')) if os.environ.get('SENDGRID_UNSUB_GROUP') else ""
DISABLE_EMAILS = not (SENDGRID_API_KEY or (SMTP_EMAIL and SMTP_PASSWORD and SMTP_PORT and SMTP_SERVER))

# Total limit on assets created by subscription tier
_SUB_TO_LIMIT = os.environ.get('SUBSCRIPTION_CODE_TO_TOTAL_ASSET_LIMITS')
SUBSCRIPTION_CODE_TO_TOTAL_ASSET_LIMITS = json.loads(_SUB_TO_LIMIT) if _SUB_TO_LIMIT else {DEFAULT_SUBSCRIPTION_CODE: math.inf}
SUBSCRIPTION_CODE_TO_TOTAL_ASSET_LIMITS = {k: math.inf if v > 1000 else v for k, v in SUBSCRIPTION_CODE_TO_TOTAL_ASSET_LIMITS.items()}  # converting high numbers to math.inf

# Available text-to-speech models by subscription
_SUB_TO_TTS = os.environ.get('SUBSCRIPTION_CODE_TO_TTS_OPTIONS')
SUBSCRIPTION_CODE_TO_TTS_OPTIONS = json.loads(_SUB_TO_TTS) if _SUB_TO_TTS else {DEFAULT_SUBSCRIPTION_CODE: get_available(AVAILABLE_TTS)}

DEFAULT_TTS_RANKINGS = ['openai_onyx', 'eleven_adam']
DEFAULT_TTS_MODEL = ""
if len(get_available(AVAILABLE_TTS)):
    DEFAULT_TTS_MODEL = get_highest_ranked_available(DEFAULT_TTS_RANKINGS, AVAILABLE_TTS)  # text-to-speech model used when a user has none selected

AUTH_SYSTEM = "clerk" if CLERK_SECRET_KEY and CLERK_JWT_PEM else "custom"
CUSTOM_AUTH_USE_DATABASE = True if (CUSTOM_AUTH_SECRET and CUSTOM_AUTH_DB_ENDPOINT and CUSTOM_AUTH_DB_USERNAME and CUSTOM_AUTH_DB_PASSWORD and CUSTOM_AUTH_DB_PORT and CUSTOM_AUTH_DB_NAME) else False

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

DEFAULT_PRODUCT_ID = os.environ.get('DEFAULT_PRODUCT_ID')

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

