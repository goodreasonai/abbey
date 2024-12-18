# Abbey 📚

Abbey is an AI interface with notebooks, basic chat, documents, YouTube videos, and more. It orchestrates a variety of AI models in a private self-hosted package. You can run Abbey as a server for multiple users using your own authentication provider, or you can run it for yourself on your own machine. Abbey is highly configurable, using your chosen LLMs, TTS models, OCR models, and search engines. You can find a hosted version of Abbey [here](https://abbey.us.ai), which is used by many students and professionals.

**Having any issues? Please, please post an issue or reach out to the creator directly! Twitter DM @gkamer8, email gordon@us.ai, or otherwise ping him – he likes it.**

If Abbey is not by default configurable to your liking, and you're comfortable writing code, please consider opening a PR with your improvements! Adding new integrations and even full interfaces is straightforward; see more details in the "Contributing" section below.

## Screenshots

![Document screenshot](screenshots/doc-ss.png)

![Workspace screenshot](screenshots/workspace-ss.png)

## Setup and Install (New)

### Prerequisites

- **Installs**: You must have Docker and  `docker compose` installed. See details [here](https://docs.docker.com/compose/install/).
- **3rd Party Credentials**: If you're setting up an outside API to work with Abbey, have those credentials handy. You'll need to configure at least 1 language model and 1 embedding model.

*If you have a previous version of Abbey and are doing the "new install" pattern with settings.yml for the first time, pull, create a new settings.yml and .env as described below, move your files from backend/app/static to file-storage, and rebuild with --build*

### Setup (3 easy steps)

Setup involves cloning/downloading this repo, creating `.env` and `settings.yml` files with your chosen AI integrations, and then running `docker compose` for either development (worse performance but easy to play around with) or production (better performance but slower to change settings). Here are the steps:

**Step 1:** Clone / download this repository and navigate inside it.

**Step 2:** Create a file called `.env` for secret keys and a file called `settings.yml` for configuration settings at the root of the repo (i.e., at the same level as the `docker-compose.yml` file). Then, enter into those files the keys / models you want to use. You can find details on how to configure each type of integration throughout this README.

The `.env` file holds any API keys or other secrets you need. **You must also include a password for the MySQL database that Abbey uses.** A `.env` file for someone using the official OpenAI API, an OpenAI Compatible API requiring a key, and the Anthropic API might look like:

```
MYSQL_ROOT_PASSWORD="my-password"
OPENAI_API_KEY="my-openai-key"
OPENAI_COMPATIBLE_KEY="my-api-key"
ANTHROPIC_API_KEY="my-anthropic-key"
```

The `settings.yml` file configures Abbey to use the models and options you want. **At minimum, you must use at least one language model and one embedding model.** Put the best models first so that Abbey uses them by default. For example, here is a `settings.yml` file that uses models from the official OpenAI API, an OpenAI compatible API, Anthropic, and Ollama:

```
lms:
  models:
    - provider: anthropic
      model: "claude-3-5-sonnet-20241022"
      name: "Claude 3.5 Sonnet"  # optional, give a name for Abbey to use
      traits: "Coding"  # optional, let Abbey display what it's good for
      desc: "One of the best models ever!"  # optional, let Abbey show a description
      accepts_images: true  # optional, put true if the model is a vision model / accepts image input
      context_length: 200_000  # optional, defaults to 8192
    - provider: openai_compatible
      model: "gpt-4o"
      accepts_images: true
      context_length: 128_000  
    - provider: ollama
      model: "llama3.2"

openai_compatible:
  url: "http://host.docker.internal:1234"  # Use host.docker.internal for services running on localhost

ollama:
  url: "http://host.docker.internal:11434"  # Use host.docker.internal for services running on localhost

embeds:
  models:
    - provider: "openai"
      model: "text-embedding-ada-002"
```

And given that you've also put the relevant keys into `.env`, that would be a complete settings file. **To configure different models, search engines, authentication services, text-to-speech models, etc.: please look for the appropriate documentation below!**

**Step 3:** If you're still playing around with your settings, you can run Abbey in dev mode by simply using:

```
docker compose up
```

In dev mode, when you change your settings / secrets, you just need to restart the containers to get your settings to apply, which can be done with:

```
docker compose restart backend frontend celery db_pooler
```

Once you're ready, you can run Abbey in production mode to give better performance:

```
docker compose -f docker-compose.prod.yml up --build
```

If you want to change your settings / secrets in prod mode, you need to rebuild the containers:

```
docker compose down
```

```
docker compose -f docker-compose.prod.yml up --build
```

**Step 4:** Now Abbey should be running at `http://localhost:3000`! Just visit that URL in your browser to start using Abbey. In dev mode, it might take a second to load.

Note that the backend runs at `http://localhost:5000` – if you go there, you should see a lyric from Gilbert and Sullivan's HMS Pinafore. If not, then the backend isn't running.

If something's not working right, please (please) file an issue or reach out to the creator directly – `@gkamer8` on Twitter or `gordon@us.ai` by email.

### Running Abbey at Different URLs / Ports

By default, Abbey runs on localhost at ports 3000 for the frontend and 5000 for the backend. If you want to alter these (since you're pretty tech savvy), you'll need to modify your docker compose file, and then add this to your `settings.yml`:

```
services:
  backend:
    public_url: http://localhost:5000  # Replace with your new user-accessible BACKEND URL
    internal_url: http://backend:5000  # This is where the frontend server calls the backend within docker
  frontend:
    public_url: http://localhost:3000  # Replace with your new user-accessible FRONTEND URL
```

### Troubleshooting

1. General: make sure that all the docker containers are actually running with `docker ps`. You should see 6: backend, frontend, celery, redis, MySQL, and db_pooler (sorry that there are so many - Abbey can do AI tasks in the background and in multiple threads, which necessitates the pooler, redis, and celery containers). If one isn't running, try restarting it with `docker compose restart backend` (or frontend, or celery, or what have you). If it keeps crashing, there's a good chance you've messed up your `settings.yml` or forgot to put appropriate secrets into `.env`. Otherwise, look at the logs.

2. docker config invalid: If it's telling you your docker compose is invalid, then you probably need to upgrade docker on your machine to something >= version 2. Abbey takes advantage of certain relatively new docker features like defaults for env variables and profiles. It's going to be easier just to upgrade docker in the long run - trust.

3. Things look blank / don't load / requests to the backend don't seem to work quite right. First, navigate to the backend in the browser, like to `http://localhost:5000` or whatever URL you put in originally. It should give you a message like "A British tar is a soaring soul..." If you see that, then the backend is up and running but your backend URL config is wrong or incomplete (were you playing around with it?). If your backend isn't running, check the logs in Docker for more information – please read what they say!

4. Docker gets stuck downloading/installing/running an image. There is a possibility that you've run out of space on your machine. First, try running `docker system prune` to clean up any nasty stuff lying around in Docker that you've forgotten about. Then try clearing up space on your computer – perhaps enough for ~10gb on your machine. Then restart Docker and try again. If you still get issues – try uninstalling / reinstalling Docker.

5. The `docker compose` command refuses to run because of some "API" issue or something. If docker is running (Docker Desktop on Mac, for example), then you should restart it. If that doesn't help, try purging/cleaning its data before restarting (click the "Bug" icon in Docker Desktop if you have it - then see `clean/purge` data). If docker isn't running, then that's your problem! You need to make sure the Docker daemon (i.e. Docker Desktop on Mac) is running.

6. A port is already being used. The Abbey backend runs on port 5000 by default; the Abbey frontend runs on port 3000. It's possible that something on your computer is already using port 5000 or port 3000. On Mac that usually means AirPlay. Your goal should be to check whether anything's running on ports 3000 or 5000, and, if so, to shut down those processes. On Mac/Linux: Use `lsof -i :5000` or `lsof -i :3000` to check if any process is running on those ports. If you notice a process like 'ControlCe' running on Mac, that means "Control Center," and it's probably an airplay receiver thing. You can go into your System Settings on Mac and uncheck "AirPlay receiver". If you found something else, you can kill it with `kill -9 YOUR_PID` where `YOUR_PID` is replaced by the process ID (shown using lsof). On Windows: use `netstat -ano | findstr :5000` or `netstat -ano | findstr :3000`. You can then kill the process with `taskkill /PID YOUR_PID /F` - replace `YOUR_PID` with the process ID of the relevant process.

## Using Integrations

3rd party integrations are managed in your settings and environment variable files. Here is a summary of those available:

[Language Models (LMs)](#language-models-lms)
- OpenAI
- Anthropic
- Ollama
- Other OpenAI Compatible APIs (like LocalAI, LMStudio, etc.)

[Embedding Models (Embeds)](#embeding-models-embeds)
- OpenAI
- Ollama
- Other OpenAI Compatible APIs (like LocalAI, LMStudio, etc.)

[Text-to-Speech (TTS)](#text-to-speech-models-tts)
- OpenAI 
- OpenAI Compatible
- ElevenLabs

[Optical Character Recognition (OCR)](#optical-character-recognition-ocr)
- Mathpix

[Search Engines (Web)](#search-engines-web)
- Bing
- SearXNG (+ any engine on SearXNG)

[File Storage (Storage)](#file-storage-storage)
- s3
- Local `file-storage` folder (default)

[Authentication](#authentication)
- Google
- GitHub
- [Keycloak](#keycloak) (self-hosted)
- Clerk (reach out for details)

### Integration-Specific Configuration

**Some integrations require configuration in settings.yml. If using any of the following integrations, you must specify its settings like so:**

```
s3:
  bucket: 'your-bucket'

searxng:
  url: "http://host.docker.internal:8080"  # Replace with your URL

ollama:
  url: "http://host.docker.internal:11434"  # Replace with your URL

openai_compatible:
  url: "http://host.docker.internal:12345"  # Replace with your URL
```

These go at the root of `settings.yml` at the same level as `lms` or `embeds`.

### Language Models (LMs)

Language models are configured under `lms` in `settings.yml`. You can specify language models from any provider you wish to support, plus defaults that are used behind the scenes for things like quiz generation, summaries, and suggesting questions. You must have at least one LM for Abbey to work properly. Remember to configure the relevant provider settings if needed as [shown above](#integration-specific-configuration).

```
lms:
  defaults:  # all are optional, use the optional "code" you specify to refer to each model, or use "model-provider" like "gpt-4o-openai"
    chat: "llama3.2-ollama"  # User chat model (user can change) - defaults to first listed model
    high_performance: "gpt-4o"  # Your best language model, used for generating curricula - defaults to default chat model
    long_context: "gpt-4o"  # Model used in long-context situations - defaults to longest context model specified
    balanced: "claude-3-5-sonnet-anthropic" # Model that is in the middle for speed / accuracy - defaults to default chat model
    fast_long_context: "gpt-4o-mini-openai"  # A long context model that's fast, defaults to long_context model, used for summaries / key points
    alt_long_context: "claude-3-5-sonnet"  # A long context model used for variation in things like question generation - default to long_context

  models:
    - provider: openai  # required - see below table for options
      model: "gpt-4o"  # required, code for the API
      context_length: 128_000  # optional (defaults to 4096)
      supports_json: true  # optional, defaults to false
      accepts_images: true  # optional, defaults to false
      name: "GPT-4o"  # optional display name for the model
      desc: "One of the best models ever!"  # optional, lets Abbey display a description
      code: "gpt-4o"  # optional - defaults to 'model-provider' like 'gpt-4o-openai' - used to specify defaults above.
      disabled: false  # optional
    # Specify more in a list...
```

### LM Providers

This table gives the provider code for each provider and the relevant API key name to place in `.env`:

| Provider   | Provider Code | API Key Name           | Needs Provider Setting |
|------------|---------------|------------------------|----------------------|
| OpenAI     | openai        | OPENAI_API_KEY         | No |
| Anthropic  | anthropic     | ANTHROPIC_API_KEY      | No |
| Ollama  | ollama     |       | [Yes](#integration-specific-configuration) |
| OpenAI Compatible  | openai_compatible     | OPENAI_COMPATIBLE_KEY      | [Yes](#integration-specific-configuration) |


### Text-to-Speech Models (TTS)

Text to speech models are configured under `tts` in `settings.yml`. You can specify tts models from any provider you wish to support, plus a default. TTS models are totally optional. Remember to configure the relevant provider settings if needed as [shown above](#integration-specific-configuration).

```
tts:
  default: "openai_onyx"
  voices:
    - provider: openai  # required
      voice: "onyx"  # required
      model: "tts-1"  # required
      name: "Onyx"  # optional
      desc: "One of the best models ever!"  # optional
      code: "openai_onyx"  # optional, to set a default via a code (defaults to "voice-model-provider")
      sample_url: "https://public-audio-samples.s3.amazonaws.com/onyx.wav"  # optional
      disabled: false  # optional
```

| Provider   | Provider Code | API Key Name           | Needs Provider Setting |
|------------|---------------|------------------------|-------------|
| OpenAI     | openai        | OPENAI_API_KEY         | No |
| ElevenLabs  | eleven_labs     | ELEVEN_LABS_API_KEY      | No |
| OpenAI Compatible  | openai_compatible     | OPENAI_COMPATIBLE_KEY      | [Yes](#integration-specific-configuration) |

### Embeding Models (Embeds)

Embedding models are configured under `embeds` in `settings.yml`. For now, exactly one mandatory embedding model is used across Abbey at a time. Embedding models are used to search over documents. Remember to configure the relevant provider settings if needed as [shown above](#integration-specific-configuration).

```
embeds:
  models:
    - provider: "openai"  # required
      model: "text-embedding-ada-002"  # required
```

| Provider   | Provider Code | API Key Name           | Needs Provider Setting |
|------------|---------------|------------------------|----------------------|
| OpenAI     | openai        | OPENAI_API_KEY         | No |
| Ollama  | ollama     |       | [Yes](#integration-specific-configuration) |
| OpenAI Compatible  | openai_compatible     | OPENAI_COMPATIBLE_KEY      | [Yes](#integration-specific-configuration) |


### Search Engines (Web)

Search engines are configured under `web` in `settings.yml`. They're used when you check `Use Web` when chatting on Abbey. Remember to configure the relevant provider settings if needed as [shown above](#integration-specific-configuration).

```
web:
  engines:
    - provider: "bing"  # required

    # TO USE SEARXNG, MAKE SURE YOUR SEARXNG SETTINGS ARE CORRECT - SEE [BELOW](#searxng)
    - provider: "searxng"
    - engine: "pubmed"  # Only used for SearXNG - leave blank to search over all engines you've enabled
    
    - provider: "searxng"
    - engine: "arxiv"
    - use_pdf: true  # Some SearXNG engines give PDF URLs - this tells Abbey to go to the PDF rather than the regular result
```

| Provider   | Provider Code | API Key Name           | Needs Provider Setting |
|------------|---------------|------------------------|----------------|
| Bing     | bing        | BING_API_KEY         | No |
| SearXNG  | searxng     |       | [Yes](#integration-specific-configuration) |

#### SearXNG

SearXNG does not by default allow API access. When running your SearXNG instance, you must make sure that your SearXNG settings (not in Abbey's repo, but in `searxng/settings.yml`) allow JSON as a format, like:

```
search:
  formats:
    - html
    - json
```

You can make sure your SearXNG instance is working correctly when the following cURL request works (replace the URL with your SearXNG instance URL - the port might be different.)

```
curl -kLX GET --data-urlencode q='abbey ai' -d format=json http://localhost:8080
```

### Optical Character Recognition (OCR)

Optical Character Recognition APIs are configured under `ocr` in `settings.yml`. By default, no OCR is used. Optionally configuring OCR allows Abbey to read scanned PDFs. Abbey automatically determines whether OCR appears needed.

```
ocr:
  models:
    - provider: "mathpix"
```

| Provider   | Provider Code | API Key Names           | Needs Provider Setting |
|------------|---------------|------------------------|----------------|
| Mathpix     | mathpix        | MATHPIX_API_APP and MATHPIX_API_KEY      | No |

### Email

Email APIs are configured under `email` in `settings.yml`. Configuring email allows Abbey to send links to assets on Abbey when they're shared, plus in a few other circumstances. By default, Abbey doesn't send emails. Running abbey with the email profile (like `docker compose up --profile email`) lets Abbey send additional reminder emails for some templates.

```
email:
  default: smtp  # Refer to each service by its provider name (defaults to first specified)
  services:
    - provider: sendgrid  # Required
      email: "your-email@example.com"  # Required
      unsub_group: 24624  # Optional, only for Sendgrid
    - provider: smtp  # Regular email
      email: "your-email@example.com"
```

| Provider   | Provider Code | Mandatory Secrets           | Needs Provider Setting |
|------------|---------------|------------------------|----------------|
| Sendgrid     | sendgrid        | SENDGRID_API_KEY      | No |
| SMTP Email     | smtp        | SMTP_SERVER, SMTP_PORT, SMTP_EMAIL, and SMTP_PASSWORD | No |

### File Storage (storage)

File Storage APIs are configured under `storage` in `settings.yml`. By default, Abbey stores all uploaded files in the mounted `file-storage` folder. When backing up Abbey, you should backup that folder plus the database. If you want to use s3, you can use the following:

```
storage:
  default: s3  # All new uploads go to the default provider (you don't need to set up local)
  locations:
    - provider: s3
```

| Provider   | Provider Code | API Key Names           | Needs Provider Setting |
|------------|---------------|------------------------|----------------|
| s3     | s3        | AWS_ACCESS_KEY and AWS_SECRET_KEY      | No |
| Local     | local        |  | No |

### Authentication

Authentication providers are configured under `auth` in `settings.yml`. By default, Abbey will use a single "default" user. Setting up additional authentication providers allows multi-user setups. You can use an OAuth2 provider like Google, or you can self-host a Keycloak instance (instructions below). For providers like Google and GitHub, you'll need a client secret and client ID. When registering Abbey, you might have to provide the URL where Abbey is accessible - that would be `http://localhost:3000` by default, or whatever public URL you're using for Abbey's frontend.

```
auth:
  providers:
    - google
    - github
    - keycloak
```

| Provider   | Provider Code | Env Variables           | How to Acquire Client ID / Secret |
|------------|---------------|------------------------|----------------|
| Google     | google        | GOOGLE_CLIENT_ID and GOOGLE_SECRET      | See [here](https://developers.google.com/identity/protocols/oauth2) |
| GitHub     | github        | GITHUB_CLIENT_ID and GITHUB_SECRET | See [here](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app)  |
| Keycloak     | keycloak        | KEYCLOAK_PUBLIC_URL, KEYCLOAK_INTERNAL_URL, KEYCLOAK_REALM, KEYCLOAK_SECRET, and KEYCLOAK_CLIENT_ID | See [below](#keycloak) |

**In production environments, you should also provide additional auth secrets for handling auth tokens. Do so by adding the following to your environment file:**

```
CUSTOM_AUTH_SECRET="my-auth-secret"
REFRESH_TOKEN_SECRET="my-refresh-secret"
```

#### Keycloak

You can self-host authentication entirely using Keycloak. Using Keycloak with Abbey requires certain settings - for example, a frontend URL for the realm must be specified to allow Abbey and Keycloak to run in the same Docker VM. If you have an existing Keycloak instance, you should create a new client for Abbey with a client ID and client secret that you place in `.env`. Otherwise, here are instructions are setting up a new instance for Abbey:

Here is a `keycloak-realm.json` file you can place next to your `docker-compose` file that sets up keycloak automatically:

```
{
    "realm": "abbey-realm",
    "enabled": true,
    "loginWithEmailAllowed": true,
    "duplicateEmailsAllowed": false,
    "registrationEmailAsUsername": true,
    "attributes": {
        "frontendUrl": "http://localhost:8080"
    },
    "clients": [
      {
        "clientId": "abbey-client",
        "enabled": true,
        "protocol": "openid-connect",
        "publicClient": false,
        "secret": "not-a-secret",
        "redirectUris": ["http://localhost:3000/*"]
      }
    ],
    "users": [
      {
        "username": "testuser@example.com",
        "email": "testuser@example.com",
        "enabled": true,
        "emailVerified": true,
        "credentials": [
          {
            "type": "password",
            "value": "password"
          }
        ]
      }
    ]
}

```

Here is an example service you can run alongside that in your `docker-compose.yml` file:

```
services:
  keycloak:
    image: quay.io/keycloak/keycloak:22.0.3
    container_name: keycloak
    environment:
      KEYCLOAK_ADMIN: admin
      KEYCLOAK_ADMIN_PASSWORD: admin
    ports:
      - 8080:8080
    volumes:
      - ./keycloak-realm.json:/opt/keycloak/data/import/myrealm.json
    command: ["start-dev", "--import-realm"]

volumes:
  keycloak_data:
```

Keycloak also requires some additional secrets in `.env`:

```
# The Public URL should be user accessible
KEYCLOAK_PUBLIC_URL="http://localhost:8080"

# The optional Internal URL should be accessible within Docker
KEYCLOAK_INTERNAL_URL="http://keycloak:8080"

KEYCLOAK_REALM="abbey-realm"
KEYCLOAK_SECRET="not-a-secret"
KEYCLOAK_CLIENT_ID="abbey-client"
```

Adding that service + creating the `keycloak-realm.json` file + entering secrets into `.env` should allow Abbey to "just work" with Keycloak in a dev environment.

### Database

By default, Abbey has a MySQL service for which you must provide a `MYSQL_ROOT_PASSWORD` in `.env`. Abbey uses two databases, `custom_auth` for authentication and `learn` for everything else. They can be on the same or different servers. As of now, the server must be MySQL or MySQL compatible (not postgres).

You can change where the MySQL server is available, using these `.env` variables:

```
MYSQL_ROOT_PASSWORD=my-root-password

# Remember that the endpoint is accessed server side, so "mysql" is the default network name
DB_ENDPOINT=mysql
DB_USERNAME=root
DB_PASSWORD=my-root-password
DB_PORT=3306
DB_NAME=learn
DB_TYPE=local  # 'local' or 'deployed' --> changes how app deals with transaction settings
# You should set global transaction isolation level to READ COMMITTED when using your own database

CUSTOM_AUTH_DB_ENDPOINT=mysql
CUSTOM_AUTH_DB_USERNAME=root
CUSTOM_AUTH_DB_PASSWORD=my-root-password
CUSTOM_AUTH_DB_PORT=3306
CUSTOM_AUTH_DB_NAME=custom_auth
```

#### Initialization

When the default MySQL service is started, it will initialize itself using the files inside `mysql-init`. If you set up your own MySQL service, you shouuld initialize the relevant databases / tables by running those `.sql` files (copying and pasting into a terminal would be enough).

## Homepage Artwork

You may notice that on the homepage (while signed in), the right side has an image and a description. On initialization of the database, there is one image that will appear there by default (which is hosted on the internet). To change that image, or to add more, you need to add entries to the art_history table in the learn database (on the MySQL service). There you put a URL for the image and markdown for the description. The domain(s) where the image is hosted needs also to be included in `settings.yml`, like so:

```
images:
  domains:
    - "my-domain.com"
```

To add the entry into art_history, you need to execute some SQL. With docker-compose, you can use:

```
docker-compose exec mysql mysql -u root -p
```

and then use your MySQL root password (available in the .env file located in the root of the project). Then, you'll need to execute:

```
use learn;
INSERT INTO art_history (`markdown`, `image`)
VALUES ('This is my *description*', 'https://my-domain.com/image.webp');
```

An image is selected randomly to display from that `art_history` table.

## Branding

You can change Abbey's name to whatever you like using this option in `settings.yml`:

```
name: "Abbey"  # Replace with your chosen name
```

Other branding such as logos, favicons, and so on are located in `frontend/public`. You can change them by replacing the files (but keeping their names). Background images are in the `frontend/public/random` folder.

## Ping

By default, Abbey will ping a hardcoded URL when the backend starts up and each hour thereafter. This is done to track usage statistics. The backend version you're on plus your `settings.yml` are included in the ping. To disable the ping, put the following in your `settings.yml`:

```
ping: false
```

Since I can't tell the difference between a user who's set `ping: false` and a user who's stopped using Abbey, consider reaching out to gordon@us.ai so I can get a rough number of users who disable the ping.

## Contributing

One of Abbey's main strengths is its extendibility. You can implement new integrations and interfaces straightforwardly.

### Integrations

Each type of integration except for auth (see notes below) resides in a file in `backend/app/integrations`. Each type of integration implements a specific class (for example, `lm.py` gives an LM class, and each type of integration implements that class). You can simply add a class that inherits from the base class (LM, TTS, OCR, etc.). Then, you should add your class to the `PROVIDER_TO_` dictionary (there's a different one for each type of integration). For integrations that can be chosen by the user, it should automatically pop up once the appropriate change has been made in `settings.yml` (for example, a user can select his search engine, language model, and text-to-speech model). For integrations like `embed` which are chosen by Abbey by default, you should make sure that your integration is the default in `settings.yml`.

If your integration relies on secrets, you should add it to `backend/app/configs/secrets.py` using the pattern specified and then import it into the integration file (e.g., `lm.py`).

#### Note on Authentication Integrations

Unlike the other integrations, if you're simply adding an OAuth2 provider, there is in fact no reason to do anything whatsoever on the flask backend. The Next.js frontend server handles everything. What you need to do is:

1. Create a provider class in `frontend/src/pages/api/auth/[...auth].js`. The simplest example is the GoogleAuth class (extending BaseAuth) which provides three URLs: an OAuth2 auth endpoint; an OAuth2 token endpoint; and an OpenID Connect user info endpoint. Since GitHub does not implement standard OpenID connect, it implements the getUserData() function directly.
2. Conditionally add an instance for that provider class to the `authProviders` variable based on the availability of secrets.
3. Create a frontend login button for that provider in `frontend/src/auth/custom.js`. First, that means pushing to `enabledProviders` the code of your new provider conditionally based on whether an environment variable is set to 1 (the environment variable must start with NEXT_PUBLIC so that it's available client-side). Second, that means adding an object to the `providers` list specifying your provider code and button value (you can add your provider's logo by following the pattern and adding the logo to `frontend/public/random`).

#### Note on Search Engine Integrations

One note on search engines: some class functions for a search engine return custom search objects; the relevant classes are implemented in `web.py`, and you should take a look if you choose to implement a new search engine integration.

### Contributing Your Own Template (AI interface)

In Abbey, everything is an "asset", and every asset implements a "template". For example, if you upload a document, it becomes an "asset" of template `document`. Similarly, if you create a new Workspace, it becomes an "asset" of template `notebook` (the internal name for a Workspace). On the frontend, the interface provided to a user is determined by the template he's looking at. There are a littany of common variables that must be set for each template (for example, whether or not the template is allowed to be chatted with, if it's in folder or something like that). Those variables and implemented functions determine, among other things, the way that general endpoints like `/asset/chat` behave.

On the backend, all templates are classes that inherit from the `Template` base class. These templates are located in their own files in `backend/app/templates`. The templates are registered in `backend/app/templates.py`. You must add an instance of your template there in order to enable it. You must also add the template to `backend/app/configs/user_config.py`. Inside a template file may also be specific endpoints for that template; if you choose to create one, it must be registered in `backend/app/__init__.py`.

On the frontend, all templates are implemented in one file, `frontend/src/template.js`. Each template there is a class that inherits from the `Template` class. At the bottom of the file, there are various lists and objects that determine the availability of the template; you must at the very least add your template to the `TEMPLATES` object to make it available to users.

### A Note on Linked Asset Sources

Some templates are like leaves; for example, documents have no linked asset sources, which means that when you chat with a document, you are truly chatting only with that one document. Other templates have linked sources. For example, a folder's contents are linked assets. This system exists for other templates like the text editor, which can source material from other assets with its AI write functionality. Using sources in a consistent way makes sure that functionality that extends across templates, like sharing assets, remains functional. If you share a folder with someone, for example, the permissions propagate down to all of the items inside that folder.

The standard way to retrieve information about an asset's sources on the frontend is with the `/assets/sources-info` endpoint. The standard way to add a source to an asset is with the endpoints `/assets/add-resource` and `/assets/add-resources`. These endpoints are looking for an entry in the `asset_metadata` table with key `retrieval_source` whose value is an asset id. See more details on those endpoints in `backend/app/assets.py`.
