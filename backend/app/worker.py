from celery import Celery
from .configs.user_config import CELERY_RESULT_BACKEND, CELERY_BROKER_URL
import pickle
from .retriever import Retriever, ResourceRetriever
from .db import get_db


def make_celery():
    celery = Celery(
        backend=CELERY_RESULT_BACKEND,
        broker=CELERY_BROKER_URL
    )
    celery.conf.update(
        ignore_result=True
    )

    return celery

celery = make_celery()


# Assumes function is serialized
# Recall that the function must not be local.
@celery.task
def task_general(sfunc, *args, **kwargs):
    func = pickle.loads(sfunc)
    return func(*args, **kwargs)  # not strictly necessary to return


# Specific task for apply since it's a generator (for decent reason)
# ... and generators are not JSON serializable
# But: appliers themselves are!
@celery.task
def task_apply(sapplier, *args, **kwargs):
    db = get_db(new_connection=True)
    applier: Retriever = pickle.loads(sapplier)
    application = applier.apply(*args, **kwargs, db=db)
    for _ in application:
        pass


@celery.task
def task_new_desc(sretriever):
    db = get_db(new_connection=True)
    ret: ResourceRetriever = pickle.loads(sretriever)
    new_desc = ret.make_new_desc()
    from .asset_actions import has_asset_desc_been_updated, mark_asset_desc_as_updated
    # Do a quick check to make sure asset hasn't been updated in interim
    has_been_updated = has_asset_desc_been_updated(ret.resource_manifest['asset_id'], db=db)
    if not has_been_updated:
        sql = """
            UPDATE assets SET `preview_desc`=%s WHERE `id`=%s
        """
        curr = db.cursor()
        asset_id = ret.resource_manifest['asset_id']
        curr.execute(sql, (new_desc, asset_id))
        mark_asset_desc_as_updated(None, ret.resource_manifest['asset_id'], db=db)
        db.commit()
