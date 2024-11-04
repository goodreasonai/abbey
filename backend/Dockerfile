# Context for running this is in the parent directory

FROM usaiinc/abbey-backend:latest
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install -r requirements.txt
COPY backend /app
EXPOSE 5000
CMD ["gunicorn", "-k", "geventwebsocket.gunicorn.workers.GeventWebSocketWorker", "-w", "1", "-b", "0.0.0.0:5000", "--reload", "--log-level", "debug", "app:create_app()"]
