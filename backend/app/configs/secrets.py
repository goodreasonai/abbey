import os
from dotenv import load_dotenv


load_dotenv()  # Load in environment variables

SECRET_KEY = os.environ.get("SECRET_KEY")  # For flask

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")

CLERK_JWT_PEM = os.environ.get("CLERK_JWT_PEM")
CLERK_SECRET_KEY = os.environ.get("CLERK_SECRET_KEY")

CUSTOM_AUTH_SECRET = os.environ.get("CUSTOM_AUTH_SECRET")
CUSTOM_AUTH_DB_ENDPOINT = os.environ.get("CUSTOM_AUTH_DB_ENDPOINT")
CUSTOM_AUTH_DB_USERNAME = os.environ.get("CUSTOM_AUTH_DB_USERNAME")
CUSTOM_AUTH_DB_PASSWORD = os.environ.get("CUSTOM_AUTH_DB_PASSWORD")
CUSTOM_AUTH_DB_PORT = os.environ.get("CUSTOM_AUTH_DB_PORT")
CUSTOM_AUTH_DB_NAME = os.environ.get("CUSTOM_AUTH_DB_NAME")

# For boto3 access
AWS_ACCESS_KEY = os.environ.get("AWS_ACCESS_KEY")
AWS_SECRET_KEY = os.environ.get("AWS_SECRET_KEY")
S3_BUCKET_NAME = os.environ.get("S3_BUCKET_NAME")

DB_ENDPOINT = os.environ.get("DB_ENDPOINT")

DB_USERNAME = os.environ.get("DB_USERNAME")
DB_PASSWORD = os.environ.get("DB_PASSWORD")
DB_PORT = int(os.environ.get("DB_PORT"))
DB_NAME = os.environ.get("DB_NAME")
DB_TYPE = os.environ.get("DB_TYPE")  # 'local' or 'deployed' --> changes how app deals with transaction settings

# The one I use for dev has app ID u_s_artificialintelligenceinc__3b89a2_3e0cfb, starts with ef167, and ends in 0a41
MATHPIX_API_KEY = os.environ.get("MATHPIX_API_KEY")
MATHPIX_API_APP = os.environ.get("MATHPIX_API_APP")

STRIPE_PUBLISHABLE_KEY = os.environ.get("STRIPE_PUBLISHABLE_KEY")
STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY")

FRONTEND_URL = os.environ.get("FRONTEND_URL")  # used in Stripe integration.

OLLAMA_URL = os.environ.get('OLLAMA_URL')
OLLAMA_LMS = os.environ.get('OLLAMA_LMS')
OLLAMA_EMBEDS = os.environ.get('OLLAMA_EMBEDS')

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
