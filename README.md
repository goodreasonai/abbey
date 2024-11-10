# Abbey

Abbey is an open source AI interface for chat, documents, YouTube videos, workspaces, and more. It orchestrates a variety of AI models in a private self-hosted package. You can run Abbey as a server for multiple users using your own authentication provider, or you can run it for yourself on your own machine. Abbey is highly configurable and extendible, using your chosen LLMs, TTS models, OCR models, and search engines. You can find a hosted version of Abbey [here](https://abbey.us.ai), which is used by thousands of students and professionals.

If Abbey is not by default configurable to your liking, and you're comfortable writing code, please consider opening a PR with your improvements! Adding new integrations and even full interfaces is straightforward; see more details in the "Contributing" section below.

## Setup and Install

### Prerequisites

- **Installs**: You must have `docker-compose` installed. See details [here](https://docs.docker.com/compose/install/).
- **3rd Party Credentials**: AI functionality on Abbey relies on 3rd party API keys, which you should have ready while installing. *You must have an API key for OpenAI* – this is due to a dependence on OpenAI embedding functions (and also, you should probably use some of their models). In order to enable different users, you must have a client ID and secret key for at least one OAuth2 provider; Abbey currently supports Google, Keycloak, and GitHub. You may also have API keys ready for Anthropic, Bing, and Mathpix; to send emails using Abbey, you must provide credentials for an SMTP server (like, your own email) or a Sendgrid API key.

### Setup Options

You may either run the `run.sh` bash script and follow directions to enter in your keys and preferences, or you can manually define environment variables.

1. Setting up with `run.sh`: Run the setup bash script, `run.sh`, using `./run.sh` on Mac or Linux, or using `bash run.sh` on Windows with Git Bash or some other way to run bash scripts. You may need to run the script with superuser privileges depending on your setup, like `sudo ./run.sh`. The script will prompt you for API keys and other credentials and automatically generate three environment variable files for the backend, frontend, and root directories. You can see more details about the environment variable files in the manual setup.
2. Setting up manually: see the "Manual Setup" section below for more details.

If you're using `run.sh` and don't have all your API keys handy, you can go in after and add the keys; see the manul setup guide below.

### Run

Running Abbey with `./run.sh` is recommended; you may need to use `sudo ./run.sh` if your setup requires superuser privileges to run `docker-compose`.

If you would like to run Abbey in development mode (i.e. because you're triyng to contibute to Abbey), use the `--dev` flag. If you're switching between dev and prod builds, use the `--build` flag to rebuild the containers.

## Manual Setup TODO

### Authentication

### AI APIs

#### LLMs

#### OCR

#### TTS

### Email

### TODO

## Contributing TODO