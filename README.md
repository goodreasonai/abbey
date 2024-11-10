# Abbey

Abbey is an open source AI interface for chat, documents, YouTube videos, workspaces, and more. It orchestrates a variety of AI models in a private self-hosted package. You can run Abbey as a server for multiple users using your own authentication provider, or you can run it for yourself on your own machine. Abbey is highly configurable and extendible, using your chosen LLMs, TTS models, OCR models, and search engines. You can find a hosted version of Abbey [here](https://abbey.us.ai), which is used by thousands of students and professionals.

If you have any questions or suggestions, please open a GitHub issue! Otherwise, you may email us at `team@us.ai`.

If Abbey is not by default configurable to your liking, and you're comfortable writing code, please consider opening a PR with your improvements! Adding new integrations and even full interfaces is straightforward; see more details in the "Contributing" section below.

## Setup and Install

### Prerequisites

- **Installs**: You must have `docker-compose` installed. See details [here](https://docs.docker.com/compose/install/).
- **3rd Party Credentials**: AI functionality on Abbey relies on 3rd party API keys, which you should have ready while installing. *You must have an API key for OpenAI* – this is due to a dependence on OpenAI embedding functions (and also, you should probably use some of their models). In order to enable different users, you must have a client ID and secret key for at least one OAuth2 provider; Abbey currently supports Google, Keycloak, and GitHub. You may also have API keys ready for Anthropic, Bing, and Mathpix; to send emails using Abbey, you must provide credentials for an SMTP server (like, your own email) or a Sendgrid API key.

### Setup Options

You may either run the `run.sh` bash script and follow directions to enter in your keys and preferences, or you can manually define environment variables.

1. Setting up with `run.sh`: Run the setup bash script, `run.sh`, using `./run.sh` on Mac or Linux, or using `bash run.sh` on Windows with Git Bash or some other way to run bash scripts. You may need to run the script with superuser privileges depending on your setup, like `sudo ./run.sh`. The script will prompt you for API keys and other credentials and automatically generate three environment variable files for the backend, frontend, and root directories. If you're using `run.sh` and don't have all your API keys handy, you can go in after and add the keys; see the manual setup guide below. Otherwise, you're done.

or

2. Setting up manually: see the "Manual Setup" section below for more details.

### Run

Running Abbey with `./run.sh` is recommended; you may need to use `sudo ./run.sh` if your setup requires superuser privileges to run `docker-compose`. That's it.

If you would like to run Abbey in development mode (i.e. because you're trying to contribute to Abbey), use the `--dev` flag. If you're switching between dev and prod builds, use the `--build` flag to rebuild the containers.

If you'd like to use `docker-compose` directly, you need to make sure that it's run with at least two environment variables: `BUILD_ENV=prod` (or dev) and `PYTHONUNBUFFERED=false`. If you're allowing Abbey to send emails, use also `--profile email`

## Manual Setup and Configuration

Abbey requires three environment variable files to run properly: a backend `.env` file with path `backend/app/configs/.env`; a frontend `.env.local` file with the path `frontend/.env.local`; and a `.env` file located in the root of the project. These files contain your third party keys for accessing AI APIs, email servers, and more. Some keys should match between the front and backend; some are only present on one of the two.

Here is what the `.env` backend file looks like:

```
# The OpenAI API key is mandatory
OPENAI_API_KEY="sk-my-openai-key"

# Email Server Details (Optional, and you can use either SMTP or Sendgrid)
SMTP_SERVER="mail.server.com"
SMTP_PORT="465"
SMTP_EMAIL="your_email@us.ai"
SMTP_PASSWORD="my-smtp-password"

SENDGRID_API_KEY="sendgrid-api-key"
SENDGRID_UNSUB_GROUP="sendgrid-unsubscribe-group"
SENDGRID_EMAIL="my-sendgrid-email@us.ai"

# Optional API keys (lacking them will disable the relevant features / models)
ELEVEN_LABS_API_KEY="my-elevenlabs-api-key"
BING_API_KEY="my-bing-api-key"
ANTHROPIC_API_KEY = "my-anthropic-api-key"

# Mathpix is used for OCR on PDFs - note that you need both an app name and key for that app
MATHPIX_API_APP="my-mathpix-app"
MATHPIX_API_KEY="my-mathpix-api-key"

# These credentials need to match the actual credentials for the MySQL database you use
# The included docker-compose file starts a MySQL server with a root password determined by an environment variable
DB_ENDPOINT=mysql
DB_USERNAME=root
DB_PASSWORD="your-db-password"
DB_PORT=3306
DB_NAME=learn

# This just causes the backend server to run some commands that might otherwise be restricted to it, like changing the isolation level to read-commited
DB_TYPE=local

# You can enable s3 storage (instead of using static storage)
AWS_ACCESS_KEY = "my-aws-access-key"
AWS_SECRET_KEY = "my-aws-secret-key"
S3_BUCKET_NAME = "my-s3-bucket-name"

# This secret should match the frontned authentication secret
CUSTOM_AUTH_SECRET="your-custom-auth-secret"

# In some production environments, the YouTube transcription API will fail
# You can fix this by using a proxy
PROXY_URL_HTTP = "http://proxy-username:proxy-password@my-proxy.com:proxy-port"
PROXY_URL_HTTPS = "https://proxy-username:proxy-password@my-proxy.com:proxy-port"

# This is a flask argument
SECRET_KEY="your-secret-key"
```

Here is what the `.env.local` file for the frontend looks like:

```
# The backend URL must be accessible to the client; when running only for one user on the same machine, it's http://localhost:5000
NEXT_PUBLIC_BACKEND_URL="http://my-backend-url.com"
NEXT_SERVER_SIDE_BACKEND_URL="http://backend:5000"

# The frontend URL must also be accessible to the client. By default it runs on port 3000.
NEXT_PUBLIC_ROOT_URL="http://my-frontend-url.com"

# Your custom authentication variables
# If you don't want to use a particular provider, then just don't include the relevant variables.
# The enable variables are either 0 for false or 1 for true.
NEXT_PUBLIC_ENABLE_GOOGLE_AUTH="0"
GOOGLE_CLIENT_ID="google-auth-client-id"
GOOGLE_SECRET="google-secret"

NEXT_PUBLIC_ENABLE_GITHUB_AUTH="0"
GITHUB_CLIENT_ID="github-client-id"
GITHUB_SECRET="github-secret"

# You may use a separate keycloak private URL if you're running Keycloak in the same docker vm
# Otherwise, just don't include one
KEYCLOAK_PUBLIC_URL="http://localhost:8080"
KEYCLOAK_PRIVATE_URL="http://keycloak:8080"
KEYCLOAK_REALM="my-keycloak-realm"
KEYCLOAK_SECRET="my-keycloak-secret"
KEYCLOAK_CLIENT_ID="my-keycloak-client-id"

# These secrets are used for all custom auth tokens
JWT_SECRET="my-jwt-secret"
REFRESH_TOKEN_SECRET="my-jwt-refresh-token-secret"

# When using multiple OAuth2 providers, a MySQL server is recommended to assign unique user ids for each email address
CUSTOM_AUTH_DATABASE_ENABLED=0
CUSTOM_AUTH_DB_HOST="mysql"
CUSTOM_AUTH_DB_USER="root"
CUSTOM_AUTH_DB_PASSWORD="your-mysql-db-password"
CUSTOM_AUTH_DB_NAME="custom_auth"
CUSTOM_AUTH_DB_PORT="3306"
```

The `.env` file in the root has just one variable:

```
MYSQL_ROOT_PASSWORD="your-mysql-root-password"
```

It's passed to the docker-compose file so that when your MySQL server is built, it sets the correct root MySQL password.

## Summary of 3rd Party Integrations

3rd party integrations are managed in the environment variable files (see above). In the project code, they are organized in the `backend/app/integrations` folder. Here is a summary of those available:

AI APIs (lm.py, ocr.py, tts.py, and embed.py)
- OpenAI
- Anthropic
- ElevenLabs
- Mathpix

Search Engines (web.py)
- Bing

File Storage (file_storage.py)
- s3
- Local static folder (default)

Authentication (auth.py - if none is available, one default sign in is provided)
- Google
- GitHub
- Keycloak
- Clerk (contact us for instructions if you're interested)

## Contributing Your Own Integration

Abbey can integrate easily with a variety of 3rd party services, including AI APIs, authentication servers, storage servers, and more. It is straightforward to implement your own backend integration in Python. Details for doing so are below.

Each type of integration (auth, embedding functions, language models, etc.) has its own file in `backend/app/integrations`. Each type of integration has its own base class implemented in the relevant file (e.g., `LM()`, `TTS()`, `OCR()`, ...). Each integration provider is implemented as a class that inherits from that base class (e.g., `OpenAI(LM)`, `Anthropic(LM)`). Each model is implemented as a class that inherits from a provider class (e.g., `GPT4(OpenAI)`, `Claude3Opus(Anthropic)`, etc.). Intances of these classes are put into a PROVIDERS dictionary (e.g., `LM_PROVIDERS`, `OCR_PROVIDERS`, `SEARCH_PROVIDERS`, etc.). Each instance has associated with it a hardcoded "code" which specifies the unique model (e.g., `gpt-4o`, `bing`, `claude-3-5-sonnet`), and the PROVIDERS dictionary maps from that code to the object instance.

Each model class implements relevant class functions. For example, classes inheriting from `LM()` implement a `run(...)` function and a `stream(...)` function, which return generated tokens in an all-at-once or streaming context, respectively. You can and should look at the existing classes for details on their implementation.

The file `backend/app/config/user_config.py` is **extremely important** for actually enabling your integration. Here are the details:

- An `AVAILABLE_PROVIDERS` dictionary determines which providers are enabled based on the set environment variables. If you add a new API provider – especially for LLMs – you should add your availability condition and add a new provider code.
- Other AVAILABLE dictionaries like `AVAILABLE_LM` or `AVAILABLE_EMBED` that map available providers to available models.
- `LM_ORDER`, which specifies the order in which a user is shown available language models.
- Default model variables, like `DEFAULT_CHAT_MODEL_RANKINGS`, which specifies the order in which models should take precedence for default status (some may or may not be enabled in AVAILABLE_PROVIDERS in any given setup). There are also simpler default model variables, like `DEFAULT_EMBEDDING_OPTION`, which is simply the code for the embedding model to use.

For more information, simply look at the file; it's well-commented and not that complicated. In some cases, there is basic logic to determine which integrations are used: for example, if AWS credentials are present, s3 is used as the storage option; otherwise, Abbey uses local storage in the `static` folder.

### Note on Authentication Integrations

Unlike the other integrations, if you're simply adding an OAuth2 provider, there is in fact no reason to do anything whatsoever on the flask backend. The Next.js frontend server handles everything. What you need to do is:

1. Create a provider class in `frontend/src/pages/api/auth/[...auth].js`. The simplest example is the GoogleAuth class (extending BaseAuth) which provides three URLs: an OAuth2 auth endpoint; an OAuth2 token endpoint; and an OpenID Connect user info endpoint. Since GitHub does not implement standard OpenID connect, it implements the getUserData() function directly.
2. Conditionally add an instance that provider class to the `authProviders` variable based on the availability of secrets.
3. Create a frontend login button for that provider in `frontend/src/auth/custom.js`. First, that means pushing to `enabledProviders` the code of your new provider conditionally based on whether an environment variable is set to 1 (the environment variable must start with NEXT_PUBLIC so that it's available client-side). Second, that means adding an object to the `providers` list specifying your provider code and button value (you can add your provider's logo by following the pattern and adding the logo to `frontend/public/random`).

### Note on Search Engine Integrations

One note on search engines: some class functions for a search engine return custom search objects; the relevant classes are implemented in `web.py`, and you should take a look if you choose to implement a new search engine integration.

## Contributing Your Own Template (AI interface)

In Abbey, everything is an "asset", and every asset implements a "template". For example, if you upload a document, it becomes an "asset" of template `document`. Similarly, if you create a new Workspace, it becomes an "asset" of template `notebook` (the internal name for a Workspace). On the frontend, the interface provided to a user is determined by the template he's looking at. There are a littany of common variables that must be set for each template (for example, whether or not the template is allowed to be chatted with, if it's in folder or something like that). Those variables and implemented functions determine, among other things, the way that general endpoints like `/asset/chat` behave.

On the backend, all templates are classes that inherit from the `Template` base class. These templates are located in their own files in `backend/app/templates`. The templates are registered in `backend/app/templates.py`. You must add an instance of your template there in order to enable it. You must also add the template to `backend/app/configs/user_config.py`. Inside a template file may also be specific endpoints for that template; if you choose to create one, it must be registered in `backend/app/__init__.py`.

On the frontend, all templates are implemented in one file, `frontend/src/template.js`. Each template there is a class that inherits from the `Template` class. At the bottom of the file, there are various lists and objects that determine the availability of the template; you must at the very least add your template to the `TEMPLATES` object to make it available to users.

### A Note on Linked Asset Sources

Some templates are like leaves; for example, documents have no linked asset sources, which means that when you chat with a document, you are truly chatting only with that one document. Other templates have linked sources. For example, a folder's contents are linked assets. This system exists for other templates like the text editor, which can source material from other assets with its AI write functionality. Using sources in a consistent way makes sure that functionality that extends across templates, like sharing assets, remains functional. If you share a folder with someone, for example, the permissions propagate down to all of the items inside that folder.

The standard way to retrieve information about an asset's sources on the frontend is with the `/assets/sources-info` endpoint. The standard way to add a source to an asset is with the endpoints `/assets/add-resource` and `/assets/add-resources`. These endpoints are looking for an entry in the `asset_metadata` table with key `retrieval_source` whose value is an asset id. See more details on those endpoints in `backend/app/assets.py`.

## Deploying on a Network

The frontend is exposed on port 3000, and the backend is exposed on port 5000. Both services need to be available to your users. A straightforward way to make Abbey available is to use a tunneling service like [Cloudflare Tunnel](https://www.cloudflare.com/products/tunnel/) or [Ngrok](https://ngrok.com/). You would map two tunnels to ports 3000 and 5000. Knowing the URLs of your tunnels, you must set the correct frontend and backend URLs in the relevant environment variable files (see manual setup).

Another way to deploy would be to put one or both services behind a reverse proxy server like Nginx. You may find it convenient to change the `docker-compose.yml` file to map at least one of the services to port 80.

**Remember to set the `NEXT_PUBLIC_BACKEND_URL` and `NEXT_PUBLIC_ROOT_URL` variables to their correct values in `frontend/.env.local` if you didn't specify them in your initial setup.**
