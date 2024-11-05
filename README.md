# Abbey

Abbey is an open source AI interface for chat, documents, YouTube videos, workspaces, and more. It orchestrates a variety AI models in a private self-hosted package. Abbey is highly configurable and extendible, using your chosen LLMs, TTS models, OCR models, and search engines. You can find a hosted version of Abbey [here](https://abbey.us.ai), which is used by thousands of students and professionals.

If Abbey is not by default configurable to your liking, and you're comfortable writing code, please consider opening a PR with your improvements! Adding new integrations and even full interfaces is straightforward; see more details in the "Contributing" section below.

## Setup and Install

### Prerequisites

- **Installs**: You must have `docker-compose` installed. See details [here](https://docs.docker.com/compose/install/).
- **3rd Party Credentials**: *You must have an API key for OpenAI* – this is due to a dependence on openai embedding functions, which will be changed in upcoming versions of Abbey. In order to enable different users, you must have a client ID and secret key for at least one OAuth2 provider; Abbey currently supports Google, Keycloak, and GitHub. You may also have API keys ready for Anthropic, Bing, and Mathpix; to send emails, you must provide credentials for an SMTP server (like, your own email) or a Sendgrid API key.

### Setup Options

You may either run the `run.sh` bash script and follow directions to enter in your keys and preferences, or you can manually define configuration variables.

1. Setting up with `run.sh`: Run the setup bash script, `run.sh`, using `./run.sh` on Mac or Linux, or using `bash run.sh` on Windows with Git Bash or some other way to run bash scripts. You may need to run the script with superuser privileges depending on your setup, like `sudo ./run.sh`. The script will prompt you for API keys and other credentials and automatically generate three environment variable files for the backend, frontend, and root directories. You can see more details about the environment variable files in the manual setup.
2. Setting up manually: see the "Manual Setup" section below for more details.

### Run

Running Abbey with `./run.sh` is recommended; you may need to use `sudo ./run.sh` if your setup requires superuser privileges to run `docker-compose`.

Otherwise, you can directly use `docker-compose` from the root directory with the appropriate profiles, such as `docker-compose --profile email --profile prod` for a default setup with email enabled.

## Manual Setup TODO

### Authentication

### AI APIs

#### LLMs

#### OCR

#### TTS

### Email

### TODO

## Contributing TODO