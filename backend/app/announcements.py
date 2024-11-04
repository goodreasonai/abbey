from .auth import User, token_optional
from flask import (
    Blueprint,
    request,
    current_app,
    request,
    send_file
)
from flask_cors import cross_origin

from .db import get_db
from .template_response import MyResponse
from pymysql.err import IntegrityError

# For logging user activity

bp = Blueprint('announcements', __name__, url_prefix="/announcements")

@bp.route('/manifest', methods=('GET',))
@token_optional
@cross_origin()
def manifest(user: User):

    limit = request.args.get('limit')

    DEFAULT_LIMIT = 10

    if not limit or limit > 100:
        limit = DEFAULT_LIMIT

    sql = """
        SELECT * FROM announcements
        ORDER BY timestamp DESC
        LIMIT %s
    """

    db = get_db()
    curr = db.cursor()
    curr.execute(sql, (limit,))
    res = curr.fetchall()

    return MyResponse(True, {'results': res}).to_json()

