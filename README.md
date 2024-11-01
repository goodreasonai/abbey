# Abbey

Abbey is an open source AI interface. It orchestrates LLMs, text-to-speech models, embedding models, and more in a private self-hosted package.

## Install

**The easiest way to install abbey is to clone this repository and run the setup bash script from the project's root directory using `./run.sh` on Mac or Linux, or `bash run.sh` on Windows with Git Bash or some other way to run bash scripts.** The script will guide you through each step of the process. Once it's setup and installed, running that same command will also start up Abbey.

It will first check to make sure that python is installed before running the `run.py` script. If Python is not installed, it will ask before making the installation itself.

---

Here are the details of the installation script if you would like more insight or control over the process:

1. It will check to make sure Docker is installed, which is the environment in which Abbey is expected to run. Abbey consists of multiple docker containers run using `docker-compose`.
2. It will create appropriate backend and frontned configuration files as well as files to store environment variables and secret keys.
3. It will create a `docker-compose.yml` file from which Abbey is run.
4. It will call `docker-compose up`. The first time running the script, it will pull all of the relevant images and build the containers. From then on, startup will be much quicker.
