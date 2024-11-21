# Abbey 📚

Abbey is an AI interface with notebooks, basic chat, documents, YouTube videos, and more. It orchestrates a variety of AI models in a private self-hosted package. You can run Abbey as a server for multiple users using your own authentication provider, or you can run it for yourself on your own machine. Abbey is highly configurable and extendible, using your chosen LLMs, TTS models, OCR models, and search engines. You can find a hosted version of Abbey [here](https://abbey.us.ai), which is used by many students and professionals.

**Having any issues? Please, please post an issue or reach out to the creator directly! Twitter DM @gkamer8, email gordon@us.ai, or otherwise ping him – he likes it.**

If Abbey is not by default configurable to your liking, and you're comfortable writing code, please consider opening a PR with your improvements! Adding new integrations and even full interfaces is straightforward; see more details in the "Contributing" section below. Lastly, Abbey provides simple configuration variables for things like its name, logo, and color scheme. See below how to switch them up.

## Screenshots

![Document screenshot](screenshots/doc-ss.png)

![Workspace screenshot](screenshots/workspace-ss.png)

## Setup and Install

### Prerequisites

- **Installs**: You must have `docker-compose` installed. See details [here](https://docs.docker.com/compose/install/).
- **3rd Party Credentials**: AI functionality on Abbey relies on 3rd party integrations. If you're planning on using an API like the OpenAI API, you should have those credentials handy. *You must start Abbey with at least one language model and one embedding model*. In order to enable multi-user setups, you must use a separate OAuth2 provider and have a client ID and secret key ready; Abbey currently supports Google, Keycloak, and GitHub. You may also have API keys ready for Anthropic, Bing, and Mathpix. To send emails using Abbey, you must provide credentials for an SMTP server (like, your own email) or a Sendgrid API key.

### Setup Options

You may either run the `run.sh` bash script and follow directions to enter in your keys and preferences, or you can manually define environment variables.

1. Clone the repo and navigate inside it.
2. Start the Docker daemon if necessary (i.e., by running Docker Desktop on Mac)

3. Set up with `run.sh`: Run the setup bash script, `run.sh`, by using `./run.sh` on Mac or Linux. For Windows, `bash run.sh` works with Git Bash. You may need to run the script with superuser privileges depending on your setup, like `sudo ./run.sh`. The script will prompt you for API keys and other credentials and automatically generate three environment variable files for the backend, frontend, and root directories.

or

3. Set up manually by defining three environment variable files: see the "Manual Setup" section below for more details.

### Run

Running Abbey with `./run.sh` is recommended; you may need to use `sudo ./run.sh` if your setup requires superuser privileges to run `docker-compose`. That's it.

**If the backend/celery/db_pooler services stop immediately when running the first time - calmly restart them.** Use `docker-compose restart db_pooler` first, then the same for backend and celery. This issue is due to the fact that on the first startup, MySQL can take a bit longer than expected to initialize.

### Troubleshooting

1. docker config invalid: If it's telling you your docker compose is invalid, then you probably need to upgrade docker on your machine to something >= version 2. Abbey takes advantage of certain relatively new docker features like defaults for env variables and profiles. It's going to be easier just to upgrade docker in the long run - trust.

2. Things look blank / don't load / requests to the backend don't seem to work quite right. First, navigate to the backend in the browser, like to `http://localhost:5000` or whatever URL you put in originally. It should give you a message like "A British tar is a soaring soul..." If you see that, then the backend is up and running but your backend URL config is wrong or incomplete. Remember to type it out completely like `http://localhost:5000`. **If you messed it up then changed it, it might still be wrong because it's saved in the frontend-next docker volume. Delete the frontend container, delete that volume, and then rebuild.** If you don't even get the "British tar" thing, then make sure that your backend service is actually running.

3. Docker gets stuck downloading/intstalling/running an image. There is a possibility that you've run out of space on your machine. First, try running `docker system prune` to clean up any nasty stuff lying around in Docker that you've forgotten about. Then try clearing up space on your computer – perhaps enough for ~10gb on your machine. Then restart Docker and try again. If you still get issues – try uninstalling / reinstalling Docker.

4. The`docker-compose` command refuses to run because of some "API" issue or something. If docker is running (Docker Desktop on Mac, for example), then you should restart it. If that doesn't help, try purging/cleaning its data before restarting (click the "Bug" icon in Docker Desktop if you have it - then see `clean/purge` data). If docker isn't running, then that's your problem! You need to make sure the Docker daemon (i.e. Docker Desktop on Mac) is running before you run `./run.sh`.

5. A port is already being used. The Abbey backend runs on port 5000 by default; the Abbey frontend runs on port 3000. It's possible that something on your computer is already using port 5000 or port 3000. On Mac that usually means AirPlay. Your goal should be to check whether anything's running on ports 3000 or 5000, and, if so, to shut down those processes.

#### Mac and Linux

Use `lsof -i :5000` or `lsof -i :3000` to check if any process is running on those ports. If you notice a process like 'ControlCe' running on Mac, that means "Control Center," and it's probably an airplay receiver thing. You can go into your system settings and uncheck "AirPlay receiver".

If you found something else, you can kill it with `kill -9 PID` where PID is replaced by the process ID (shown using lsof).

#### Windows

Use `netstat -ano | findstr :5000` or `netstat -ano | findstr :3000`. You can then kill the process with `taskkill /PID YOUR_PID /F` - replace YOUR_PID with the process ID of the relevant process.


### Other run options

If you would like to run Abbey in development mode (i.e. because you're trying to contribute to Abbey), use the `--dev` flag. If you're switching between dev and prod builds, use the `--build` flag to rebuild the containers. You may also need to delete the `frontend-next` and `frontend-node-modules` volumes in Docker so that they are properly rebuilt.

If you'd like to use `docker-compose` directly, you might want to use the environment variable `MY_BUILD_ENV=prod` (or dev). If you want Abbey to send reminder emails, use also `--profile email` to start the special emailing service. You also need to make sure that the root password for the MySQL service is set correctly, for which you need to set `MYSQL_ROOT_PASSWORD="your-password"` (which is stored in the root `.env` file). So you might type in:

```
source .env && MY_BUILD_ENV=prod docker-compose --profile email up
```

## Manual Setup and Configuration

**Note: When changing frontend ENV variables, you must make sure to delete your old abbey_frontend-next volume so that the frontend is rebuilt!**

Abbey requires three environment variable files to run properly: a backend `.env` file with path `backend/app/configs/.env`; a frontend `.env.local` file with the path `frontend/.env.local`; and a `.env` file located in the root of the project. These files contain your third party keys for accessing AI APIs, email servers, and other configurations. Some keys should match between the front and backend; some are only present on one of the two.

Here is what the `backend/app/configs/.env` backend file looks like:

```
# The OpenAI API key is mandatory if you don't have any other embedding function setup (like an ollama one)
OPENAI_API_KEY="sk-my-openai-key"

# If you want to use an openai compatible inference service (that isn't OpenAI), you can use these variables
# If your service is running on the same machine but not the same docker VM, you should use this URL: http://host.docker.internal:<your-port>
OPENAI_COMPATIBLE_URL="https://your-compatible-api.com"
OPENAI_COMPATIBLE_KEY="not-a-key"
# For language models, you should also give the context length (in tokens) you want them to have and whether or not they support images as input (vision).
# Embedding / language models are written in well-formed JSON; here are examples:
OPENAI_COMPATIBLE_EMBEDS='[{"code": "text-embedding-3-small"}]'
OPENAI_COMPATIBLE_LMS='[{"code": "gpt-4o", "context_length": 100000, "vision": true}]'

# Ollama specifically is given extra attention and has a more featureful API at the moment.
# If Ollama is running on the same machine as Abbey but not in the same docker VM, you should use this URL:
OLLAMA_URL="http://host.docker.internal:11434"
# You specify which language models and embedding models from ollama you want using JSON.
OLLAMA_LMS='[{"code": "llama3.2", "context_length": 4096, "vision": true}, {...}, ...]'
# These are embedding models.
OLLAMA_EMBEDS='[{"code": "all-minilm"}, {...}, ...]'

# Email Server Details (Optional, and you can use either SMTP or Sendgrid)
SMTP_SERVER="mail.server.com"
SMTP_PORT="465"
SMTP_EMAIL="your-email@us.ai"
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

# The backend may instruct a redirect here; it should be publicly accessible, but in development is http://localhost:3000
FRONTEND_URL="https://your-frontend-url.com"

# This is a flask argument that may or may not be unused.
SECRET_KEY="your-secret-key"
```

Here is what the `frontend/.env.local` file for the frontend looks like:

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

# If you want to use images from an external domain, you need to list them here (separated by commas)
IMAGE_DOMAINS="some-domain.com,some-domain-2.com"

# Unless you're trying to replicate the Abbey Collections system (see our hosted version), you should hide "Collections" from the user.
NEXT_PUBLIC_HIDE_COLLECTIONS=1
```

**Note: When changing frontend ENV variables, you must make sure to delete your old abbey_frontend-next volume so that the frontend is rebuilt!**

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
- Ollama
- Other OpenAI Compatible APIs (like LocalAI, LMStudio, etc.)

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

## Homepage Artwork

You may notice that on the homepage (while signed in), the right side has an image and a description. On initialization of the database, there is one image that will appear there by default (which is hosted on the internet). To change that image, or to add more, you need to add entries to the `art_history` table in the `learn` database (on the MySQL service). There you put a URL for the image and markdown for the description. The domain where the image is hosted needs also to be included in the `IMAGE_DOMAINS` frontend environment variable (see manual setup).

To add the entry into `art_history`, you need to execute some SQL. With docker-compose, you can use:

```
docker-compose exec mysql mysql -u root -p
```

and then use your MySQL root password (available in the `.env` file located in the root of the project). Then, you'll need to execute:

```
use learn;
INSERT INTO art_history (`markdown`, `image`)
VALUES ('This is my *description*', 'https://some-hosted-image.com/image.webp');
```

## Branding

It is possible to change all of the branding of Abbey. On the frontend, the relevant file is `frontend/src/config/config.js`, which contains constants like Abbey's name, as well as React components that stand in for the logo. Images for logos and things can be place in `frontend/public`. It might be easiest to simply replace those images rather than mess around in the config.

Pretty much all colors on abbey are defined in `frontend/src/styles/globals.css`. Feel free to switch them up.

Please do not submit a PR with your custom branding.

## Contributing Your Own Integration

Abbey can integrate easily with a variety of 3rd party services, including AI APIs, authentication servers, storage servers, and more. It is straightforward to implement your own backend integration in Python. Details for doing so are below.

Each type of integration (auth, embedding functions, language models, etc.) has its own file in `backend/app/integrations`. Each type of integration has its own base class implemented in the relevant file (e.g., `LM()`, `TTS()`, `OCR()`, ...). Each integration provider is implemented as a class that inherits from that base class (e.g., `OpenAI(LM)`, `Anthropic(LM)`). Each model is implemented as a class that inherits from a provider class (e.g., `GPT4(OpenAI)`, `Claude3Opus(Anthropic)`, etc.). Intances of these classes are put into a PROVIDERS dictionary (e.g., `LM_PROVIDERS`, `OCR_PROVIDERS`, `SEARCH_PROVIDERS`, etc.) at the bottom of the file. Each instance has associated with it a hardcoded "code" which specifies the unique model (e.g., `gpt-4o`, `bing`, `claude-3-5-sonnet`), and the PROVIDERS dictionary maps from that code to the object instance.

Each model class implements relevant class functions. For example, classes inheriting from `LM()` implement a `run(...)` function and a `stream(...)` function, which return generated tokens in an all-at-once or streaming context, respectively. You can and should look at the existing classes for details on their implementation.

The file `backend/app/config/user_config.py` is **extremely important** for actually enabling your integration. Here are the details:

- An `AVAILABLE_PROVIDERS` dictionary determines which providers are enabled based on the set environment variables. If you add a new API provider – especially for LLMs – you should add your availability condition and add a new provider code.
- There are other AVAILABLE dictionaries like `AVAILABLE_LM` or `AVAILABLE_EMBED` that map available providers to available models.
- You may need to add your model to `LM_ORDER`, which specifies the order in which a user is shown available language models.
- Default model variables, like `DEFAULT_CHAT_MODEL_RANKINGS`, which specifies the order in which models should take precedence for default status (some may or may not be enabled in AVAILABLE_PROVIDERS in any given setup). There are also simpler default model variables, like `DEFAULT_EMBEDDING_OPTION`, which is simply the code for the embedding model to use.

For more information, simply look at the file; it's well-commented and not that complicated. In some cases, there is basic logic to determine which integrations are used: for example, if AWS credentials are present, s3 is used as the storage option; otherwise, Abbey uses local storage in the `static` folder.

### Note on Authentication Integrations

Unlike the other integrations, if you're simply adding an OAuth2 provider, there is in fact no reason to do anything whatsoever on the flask backend. The Next.js frontend server handles everything. What you need to do is:

1. Create a provider class in `frontend/src/pages/api/auth/[...auth].js`. The simplest example is the GoogleAuth class (extending BaseAuth) which provides three URLs: an OAuth2 auth endpoint; an OAuth2 token endpoint; and an OpenID Connect user info endpoint. Since GitHub does not implement standard OpenID connect, it implements the getUserData() function directly.
2. Conditionally add an instance for that provider class to the `authProviders` variable based on the availability of secrets.
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
