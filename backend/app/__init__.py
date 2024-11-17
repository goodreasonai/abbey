# needs to be accessible outside app context, thus global
# also: Celery needs this value for celery, but flask might need a slightly different value
# so this gets modified within create_app
LOCAL_STORAGE_PATH = "app/static"

def create_app():

    from flask import Flask
    from .configs.user_config import BACKEND_VERSION, CELERY_RESULT_BACKEND, CELERY_BROKER_URL
    from .configs.secrets import SECRET_KEY, OPENAI_API_KEY, STRIPE_SECRET_KEY
    from flask_cors import CORS
    import os
    import psutil
    import signal
    import stripe
    from .worker import celery
    from flask_socketio import SocketIO

    global LOCAL_STORAGE_PATH

    # create and configure the app
    print("Creating app...")
    app = Flask(__name__, instance_relative_config=True)

    stripe.api_key = STRIPE_SECRET_KEY

    app.config.from_mapping(
        SECRET_KEY=SECRET_KEY,
        OPENAI_API_KEY=OPENAI_API_KEY,
        CELERY_BROKER_URL=CELERY_BROKER_URL,
        CELERY_RESULT_BACKEND=CELERY_RESULT_BACKEND
    )

    app.extensions['celery'] = celery

    def find_child_processes(parent_pid):
        # This is UNIX specific.
        parent = psutil.Process(parent_pid)
        return [child.pid for child in parent.children(recursive=True)]

    def terminate_child_processes(signum, frame):
        # Seems to be a good idea to kill children (OCR, ahem) on restart.
        # I found that, despite the relevant settings to the contrary, children were not being killed
        parent_pid = os.getpid()
        child_pids = find_child_processes(parent_pid)
        
        for child_pid in child_pids:
            try:
                child = psutil.Process(child_pid)
                child.terminate()
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                continue

    signal.signal(signal.SIGINT, terminate_child_processes)
    signal.signal(signal.SIGTERM, terminate_child_processes)

    LOCAL_STORAGE_PATH = os.path.join(app.root_path, 'static')

    CORS(app, supports_credentials=True)

    # Start database
    from . import db
    db.init_app(app)

    from . import assets
    app.register_blueprint(assets.bp)

    from . import activity
    app.register_blueprint(activity.bp)

    from . import user
    app.register_blueprint(user.bp)

    from . import announcements
    app.register_blueprint(announcements.bp)

    from . import pay
    app.register_blueprint(pay.bp)

    from .templates import detached_chat
    app.register_blueprint(detached_chat.bp)

    from .templates import document
    app.register_blueprint(document.bp)

    from .templates import text_editor
    app.register_blueprint(text_editor.bp)

    from .templates import curriculum
    app.register_blueprint(curriculum.bp)

    from .templates import classroom
    app.register_blueprint(classroom.bp)

    from .templates import folder
    app.register_blueprint(folder.bp)

    from . import groups
    app.register_blueprint(groups.bp)

    from .templates import section
    app.register_blueprint(section.bp)

    from .templates import quiz
    app.register_blueprint(quiz.bp)

    from .templates import website
    app.register_blueprint(website.bp)

    from .templates import infinite_quiz
    app.register_blueprint(infinite_quiz.bp)

    from . import speak
    app.register_blueprint(speak.bp)

    from . import email
    app.register_blueprint(email.bp)

    from .templates import notebook
    app.register_blueprint(notebook.bp)

    from . import feed
    app.register_blueprint(feed.bp)

    socketio = SocketIO()
    socketio.init_app(app, cors_allowed_origins="*", async_mode='gevent')

    from .speak import register_sockets as speak_sockets
    speak_sockets(socketio)

    from .collab import register_sockets as collab_sockets
    collab_sockets(socketio)

    @app.route('/', methods=('GET',))
    def home():
        return f"A British tar is a soaring soul, as free as a mountain bird. Version: {BACKEND_VERSION}"

    print("Backend create_app() complete.")

    return app
