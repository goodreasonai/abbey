
from .auth import User, token_optional, token_required
from flask import (
    Blueprint,
    request,
    current_app,
    request,
    send_file
)
from flask_cors import cross_origin

from .db import get_db, needs_db
from .template_response import MyResponse
from pymysql.err import IntegrityError
from .auth import get_cross_permissions
from .configs.str_constants import VIEW_ACTIVITY, QUIZ_GRADE_ACTIVITY
from .asset_actions import search_assets

# For logging user activity

bp = Blueprint('activity', __name__, url_prefix="/activity")

@bp.route('/log', methods=('POST',))
@token_optional
@cross_origin()
def log(user: User):

    user_id = None
    if user:
        user_id = user.user_id
    
    asset_id = request.json.get('asset_id')
    log_type = request.json.get('type')
    metadata = request.json.get('metadata')

    sql = """
        INSERT INTO user_activity (`user_id`, `asset_id`, `ip`, `type`, `metadata`)
        VALUES (%s, %s, %s, %s, %s)
    """
    db = get_db()
    curr = db.cursor()
    try:
        curr.execute(sql, (user_id, asset_id, request.remote_addr, log_type, metadata))
    except Exception as e:
        # Probably just a double request
        pass
    db.commit()
    return MyResponse(True).to_json()

@needs_db 
def make_log(user: User, asset_id, ip, log_type, metadata='{}', db=None):
    user_id = None
    if user:
        user_id = user.user_id

    sql = """
        INSERT INTO user_activity (`user_id`, `asset_id`, `ip`, `type`, `metadata`)
        VALUES (%s, %s, %s, %s, %s)
    """
    curr = db.cursor()
    try:
        curr.execute(sql, (user_id, asset_id, ip, log_type, metadata))
        db.commit()
    except Exception as e:
        print(f"Logging Failed: {e}")


# Returns list of user_activity entries
# Groups by the assets and includes only the latest of each type of activity.
@needs_db
def get_aggregated_activity(user: User, source_asset_id, user_ids, asset_ids, db=None):
    if not (len(user_ids) and len(asset_ids)):
        return []
    
    allowed_ids = [user.user_id]
    if source_asset_id:
        perms = get_cross_permissions(source_asset_id)
        allowed_ids = [x['user_id'] for x in perms if (x['value'] == '1' or x['value'] == 1)]

    user_ids = [x for x in user_ids if x in allowed_ids]

    users_string = ",".join([f"'{x}'" for x in user_ids])  # should I be escaping? not really, since user id is our own thing.
    if not users_string:
        return []  # we love a good early return don't we folks

    asset_id_string = ",".join([str(x) for x in asset_ids])

    # Should probably put a limit on for security's sake at some point
    sql = f"""
        SELECT t1.*
        FROM user_activity t1
        INNER JOIN (
            SELECT user_id, asset_id, type, MAX(timestamp) AS max_timestamp
            FROM user_activity
            WHERE (`user_id` IN ({users_string}))
            AND (`asset_id` IN ({asset_id_string})) 
            GROUP BY user_id, asset_id, type
        ) t2 ON
                t1.user_id = t2.user_id
            AND t1.asset_id = t2.asset_id
            AND t1.type = t2.type
            AND t1.timestamp = t2.max_timestamp

        WHERE t1.asset_id IN ({asset_id_string})
        AND t1.user_id IN ({users_string})
        ORDER BY `timestamp` DESC
    """

    curr = db.cursor()
    curr.execute(sql)

    activity = curr.fetchall()

    return activity

# Returns list of user_activity entries
# Groups by asset and type, and includes only the latest of each type of activity. (like get_aggregated_activity)
@needs_db
def get_group_activity(user: User, group_id, limit=10, types=[], get_total_only=False, db=None):
    assert(user)
    assert(group_id)
    
    sql = f"""
        SELECT {"COUNT(*) AS _count" if get_total_only else "ua.*"}
        FROM user_activity ua
        INNER JOIN (
            SELECT ua.user_id, ua.asset_id, ua.type, MAX(ua.timestamp) AS max_timestamp
            FROM user_activity ua
            INNER JOIN assets a ON ua.asset_id = a.id
            WHERE ua.user_id = %s AND a.group_id = %s {"AND ua.type IN %s" if len(types) else ""}
            GROUP BY ua.user_id, ua.asset_id, ua.type
        ) t2 ON
            ua.user_id = t2.user_id
            AND ua.asset_id = t2.asset_id
            AND ua.type = t2.type
            AND ua.timestamp = t2.max_timestamp
        INNER JOIN assets a ON ua.asset_id = a.id
        WHERE ua.user_id = %s AND a.group_id = %s
        ORDER BY ua.timestamp DESC
        LIMIT %s
    """

    args = [user.user_id, group_id] + ([types] if len(types) else []) + [user.user_id, group_id, limit]
    curr = db.cursor()
    curr.execute(sql, args)

    activity = curr.fetchall()

    if get_total_only:
        return activity[0]['_count'] if activity and len(activity) else 0

    return activity


@needs_db
def get_group_progress(user: User, group_id, db=None):
    assert(user)
    assert(group_id)

    tot_activity = get_group_activity(user, group_id, types=[QUIZ_GRADE_ACTIVITY], get_total_only=True)
    _, tot_quizzes = search_assets(user, group_ids=[group_id], only_templates=['quiz'])
    
    return {'total_quizzes': tot_quizzes, 'total_quiz_grades': tot_activity}


# Simple and not tied to asset, rather than complex like aggregated activity - for basic 1 user, 1 type queries
@needs_db
def get_user_activity(user: User, activity_type, limit=10, db=None):
    sql = """
    SELECT * FROM user_activity
    WHERE `user_id`=%s
    AND `type`=%s
    ORDER BY `timestamp` DESC
    LIMIT %s
    """
    curr = db.cursor()
    curr.execute(sql, (user.user_id, activity_type, limit))
    res = curr.fetchall()
    return res


@bp.route('/report', methods=('POST',))
@token_optional
@cross_origin()
def report(user: User):

    user_id = None
    if user:
        user_id = user.user_id
    
    asset_id = request.json.get('asset_id')
    log_type = request.json.get('type')
    description = request.json.get('description')
    from_path = request.json.get('from')

    sql = """
        INSERT INTO reports (`user_id`, `asset_id`, `ip`, `type`, `description`, `from`)
        VALUES (%s, %s, %s, %s, %s, %s)
    """
    db = get_db()
    curr = db.cursor()
    curr.execute(sql, (user_id, asset_id, request.remote_addr, log_type, description, from_path))
    db.commit()

    return MyResponse(True).to_json()

