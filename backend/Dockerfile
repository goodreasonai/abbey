# Context for running this is in the parent directory
FROM usaiinc/abbey-backend:latest
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install -r requirements.txt
COPY backend /app

ARG MY_BUILD_ENV=dev
ENV MY_BUILD_ENV=${MY_BUILD_ENV}

EXPOSE 5000

CMD ["/bin/bash", "-c", "if [ \"$MY_BUILD_ENV\" = \"prod\" ]; then \
        gunicorn -k geventwebsocket.gunicorn.workers.GeventWebSocketWorker -w 1 -b 0.0.0.0:5000 'app:create_app()'; \
    else \
        gunicorn -k geventwebsocket.gunicorn.workers.GeventWebSocketWorker -w 1 -b 0.0.0.0:5000 --reload --log-level debug 'app:create_app()'; \
    fi"]

