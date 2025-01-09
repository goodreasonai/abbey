# Scraper

This web scraper is resource intensive but higher quality than many alternatives. Websites are scraped using Playwright, which launches a Firefox browser context for each job. This is memory intensive (for organizational use, >16GB of RAM is recommended).

It is designed here to run as a standalone service, with separate API keys from the main project. This container attempts to isolate itself as much as possible, including by not holding any secrets from the parent project's .env file. The container should be run in the least permissive way possible. Individual scraping jobs are isolated via process isolation (browser contexts). For improved security, you may consider running a separate container or VM for each user.

## Setup

It first requires a `.env` file inside this folder (at the same level as this README) specifying allowed API keys that services. Allowed API keys are those that start with `SCRAPER_API_KEY`. For example, here is a `.env` file that has three available keys:

```
SCRAPER_API_KEY=should-be-secret
SCRAPER_API_KEY_OTHER=can-also-be-used
SCRAPER_API_KEY_3=works-too
```

The scraper service has a `Dockerfile` and can be run using `docker-compose`, like:

```
scraper:
  build:
    context: .
    dockerfile: scraper/Dockerfile
  volumes:
    - ./scraper:/app
    - ./scraper/supervisord.conf:/etc/supervisor/conf.d/supervisord.conf
  ports:
    - 5006:5006
```

Note that the volumes are used to make modifying the code easier but can be removed in production environments.

Note also that this scraper service runs at least three processes: a worker process, a web server, and a message passer (Redis). These are orchestrated using supervisord.

## Usage and API

The root path `/` returns status 200 if online, plus some meaningless text.

### TODO documentation
