# Context for running this is in the parent directory
FROM usaiinc/abbey-backend:latest
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install -r requirements.txt
COPY backend /app

ARG BUILD_ENV=dev
ENV BUILD_ENV=${BUILD_ENV}

EXPOSE 5000

CMD ["/bin/bash", "-c", "if [ \"$BUILD_ENV\" = \"prod\" ]; then \
        gunicorn -k geventwebsocket.gunicorn.workers.GeventWebSocketWorker -w 1 -b 0.0.0.0:5000 --reload 'app:create_app()'; \
    else \
        gunicorn -k geventwebsocket.gunicorn.workers.GeventWebSocketWorker -w 1 -b 0.0.0.0:5000 --reload --log-level debug 'app:create_app()'; \
    fi"]

