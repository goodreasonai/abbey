from flask import (
    Blueprint, request
)
from .auth import token_optional, token_required, User
from flask_cors import cross_origin
from .template_response import  MyResponse
from .asset_actions import search_assets
from .configs.user_config import MOBILE_FRIENDLY_TEMPLATES
from .db import get_db

bp = Blueprint('feed', __name__, url_prefix="/feed")

# Predominantly for mobile
@bp.route('/', methods=('GET',))
@cross_origin()
@token_required
def home(user: User):
    offset = int(request.args.get('offset', 0))
    recents, _ = [], None if offset > 0 else search_assets(user, limit=10, recent_activity=True, only_templates=MOBILE_FRIENDLY_TEMPLATES, ignore_total=True)
    
    recent_ids = [x['id'] for x in recents]
    others, _ = search_assets(user, "", 10, isolated=True, offset=offset, exclude_ids=recent_ids, only_templates=MOBILE_FRIENDLY_TEMPLATES, ignore_total=True)

    return MyResponse(True, {'results': [*recents, *others]}).to_json()

# For the abbey home page
@bp.route('/art-history', methods=('GET',))
@cross_origin()
@token_optional
def art_history(user: User):
    
    sql = """
    SELECT * FROM art_history
    ORDER BY RAND()
    LIMIT 1
    """
    db = get_db()
    curr = db.cursor()
    curr.execute(sql)
    res = curr.fetchone()
    return MyResponse(True, {'result': res}).to_json()
