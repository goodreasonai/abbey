import math
from .settings import SETTINGS
from ..integrations.lm import make_code_from_setting
from ..integrations.tts import TTS_PROVIDERS
from ..integrations.web import SEARCH_PROVIDERS
import os

BACKEND_VERSION = '0.12.7'  # Viewable when a user goes to the root "/" endpoint of the backend

AVAILABLE_TEMPLATES = ['document', 'folder', 'detached_chat', 'website', 'classroom', 'curriculum', 'quiz', 'text_editor', 'video', 'notebook', 'inf_quiz', 'section']  # could use the list in templates.py, but want to avoid imports here.

# This extra ranking is done so that a user sees a consistent / sensible ordering of LM options
LM_ORDER = [make_code_from_setting(x) for x in SETTINGS['lms']['models']]  # Order that a user would see in settings or a dropdown

APP_NAME = "Abbey"  # Used in certain prompts

#
# Subscription stuff
#

DEFAULT_SUBSCRIPTION_CODE = 'free'  # For users that don't have any subscription entries in their user metadata

# Options for user-selected chat models by subscription
SUBSCRIPTION_CODE_TO_MODEL_OPTIONS = {DEFAULT_SUBSCRIPTION_CODE: LM_ORDER}
SUBSCRIPTION_CODE_TO_TEMPLATES = {DEFAULT_SUBSCRIPTION_CODE: AVAILABLE_TEMPLATES}
SUBSCRIPTION_CODE_TO_SEARCH_OPTIONS = {DEFAULT_SUBSCRIPTION_CODE: [x.code for x in SEARCH_PROVIDERS.values()]}
SUBSCRIPTION_CODE_TO_TOTAL_ASSET_LIMITS = {DEFAULT_SUBSCRIPTION_CODE: math.inf}
SUBSCRIPTION_CODE_TO_TTS_OPTIONS = {DEFAULT_SUBSCRIPTION_CODE: [x.code for x in TTS_PROVIDERS.values()]}
_available_product_id = ""
if 'subscriptions' in SETTINGS:
    subs = SETTINGS['subscriptions']
    for key in subs:
        SUBSCRIPTION_CODE_TO_MODEL_OPTIONS[key] = subs[key]['lms']
        if 'templates' in subs[key]:  # optional
            SUBSCRIPTION_CODE_TO_TEMPLATES[key] = subs[key]['templates']
        else:
           SUBSCRIPTION_CODE_TO_TEMPLATES[key] = AVAILABLE_TEMPLATES
        SUBSCRIPTION_CODE_TO_SEARCH_OPTIONS[key] = subs[key]['limit']
        SUBSCRIPTION_CODE_TO_TOTAL_ASSET_LIMITS[key] = subs[key]['limit']
        SUBSCRIPTION_CODE_TO_TTS_OPTIONS[key] = subs[key]['tts']
        if 'product_id' in subs[key]:
            _available_product_id = subs[key]['product_id']

DEFAULT_PRODUCT_ID = _available_product_id

DEFAULT_FRONTEND_URL = "http://localhost:3000"
FRONTEND_URL = SETTINGS['services']['frontend']['public_url'] if ('services' in SETTINGS and 'frontend' in SETTINGS['services'] and 'public_url' in SETTINGS['services']['frontend']) else DEFAULT_FRONTEND_URL

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

