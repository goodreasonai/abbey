import os
from dotenv import load_dotenv

DOTENV_PATH = '/etc/abbey/.env'
load_dotenv(DOTENV_PATH)  # Load in environment variables

FLASK_SECRET_KEY = os.environ.get("FLASK_SECRET_KEY")  # For flask

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")

CLERK_JWT_PEM = os.environ.get("CLERK_JWT_PEM")
CLERK_SECRET_KEY = os.environ.get("CLERK_SECRET_KEY")

CUSTOM_AUTH_SECRET = os.environ.get("CUSTOM_AUTH_SECRET")
CUSTOM_AUTH_DB_ENDPOINT = os.environ.get("CUSTOM_AUTH_DB_ENDPOINT")
CUSTOM_AUTH_DB_USERNAME = os.environ.get("CUSTOM_AUTH_DB_USERNAME")
CUSTOM_AUTH_DB_PASSWORD = os.environ.get("CUSTOM_AUTH_DB_PASSWORD")
CUSTOM_AUTH_DB_PORT = os.environ.get("CUSTOM_AUTH_DB_PORT")
CUSTOM_AUTH_DB_NAME = os.environ.get("CUSTOM_AUTH_DB_NAME")

MYSQL_ROOT_PASSWORD = os.environ.get('MYSQL_ROOT_PASSWORD')

DB_ENDPOINT = os.environ.get("DB_ENDPOINT")
DB_USERNAME = os.environ.get("DB_USERNAME")
DB_PASSWORD = os.environ.get("DB_PASSWORD")
DB_PORT = os.environ.get("DB_PORT")
DB_NAME = os.environ.get("DB_NAME")
DB_TYPE = os.environ.get("DB_TYPE")  # 'local' or 'deployed' --> changes how app deals with transaction settings

# For boto3 access
AWS_ACCESS_KEY = os.environ.get("AWS_ACCESS_KEY")
AWS_SECRET_KEY = os.environ.get("AWS_SECRET_KEY")

# The one I use for dev has app ID u_s_artificialintelligenceinc__3b89a2_3e0cfb, starts with ef167, and ends in 0a41
MATHPIX_API_KEY = os.environ.get("MATHPIX_API_KEY")
MATHPIX_API_APP = os.environ.get("MATHPIX_API_APP")

STRIPE_PUBLISHABLE_KEY = os.environ.get("STRIPE_PUBLISHABLE_KEY")
STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY")

OPENAI_COMPATIBLE_URL = os.environ.get('OPENAI_COMPATIBLE_URL')
OPENAI_COMPATIBLE_KEY = os.environ.get('OPENAI_COMPATIBLE_KEY')
OPENAI_COMPATIBLE_LMS = os.environ.get('OPENAI_COMPATIBLE_LMS')
OPENAI_COMPATIBLE_EMBEDS = os.environ.get('OPENAI_COMPATIBLE_EMBEDS')
OPENAI_COMPATIBLE_TTS = os.environ.get('OPENAI_COMPATIBLE_TTS')

ANTHROPIC_API_KEY = os.environ.get('ANTHROPIC_API_KEY')

SENDGRID_API_KEY = os.environ.get('SENDGRID_API_KEY')

SMTP_EMAIL = os.environ.get('SMTP_EMAIL')
SMTP_SERVER = os.environ.get('SMTP_SERVER')
SMTP_PORT = os.environ.get('SMTP_PORT')
SMTP_PASSWORD = os.environ.get('SMTP_PASSWORD')

ELEVEN_LABS_API_KEY = os.environ.get('ELEVEN_LABS_API_KEY')

BING_API_KEY = os.environ.get('BING_API_KEY')

PROXY_URL_HTTP = os.environ.get('PROXY_URL_HTTP')
PROXY_URL_HTTPS = os.environ.get('PROXY_URL_HTTPS')

SCRAPER_API_KEY = os.environ.get("SCRAPER_API_KEY")
