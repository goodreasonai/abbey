from ..auth import token_optional, User
from ..db import get_db, needs_db
from ..template_response import MyResponse
from flask import (
    request,
    Blueprint
)
from flask_cors import cross_origin
from ..asset_actions import get_asset, get_asset_metadata, save_asset_metadata
from ..configs.str_constants import ASSET_STATE
from .folder import Folder
from ..activity import get_aggregated_activity
import json
from ..asset_actions import get_assets

bp = Blueprint('section', __name__, url_prefix="/section")

@needs_db
def get_section_state(user, asset_id, db=None, no_commit=True):
    asset_state = None
    metadata, _ = get_asset_metadata(user, asset_id, [ASSET_STATE], get_total=False, reverse=True, db=db, no_commit=True)
    if metadata and len(metadata) > 0:
        asset_state = json.loads(metadata[0]['value'])
        if asset_state['quizes']:  # get only quizzes that are accessible to the user (i.e. not deleted)
            quiz_ids = [x for x in asset_state['quizes'].values()]
            accessible_quiz_ids = [x['id'] for x in get_assets(user, quiz_ids)]
            asset_state['quizes'] = {k: v for k, v in asset_state['quizes'].items() if v in accessible_quiz_ids}
    return asset_state


@bp.route('/save', methods=('POST',))
@cross_origin()
@token_optional
def save_section(user: User):
    asset_id = request.json.get('id')
    state = request.json.get('state')
    if not asset_id:
        return MyResponse(False, reason="Missing asset id").to_json()
    if not state:
        return MyResponse(False, reason="Missing state").to_json()
    
    asset_row = get_asset(user, asset_id, needs_edit_permission=True)
    if not asset_row:
        return MyResponse(False, reason=f"Cannot find asset with id {asset_id}").to_json()

    save_asset_metadata(user, asset_id, ASSET_STATE, json.dumps(state), replace_all=True)  # commits

    return MyResponse(True, {'result': state}).to_json()


@bp.route('/get', methods=('GET',))
@token_optional
@cross_origin()
def get_section(user: User):

    asset_id = request.args.get('id')
    db = get_db()

    asset = get_asset(user, asset_id, db=db)
    if not asset:
        return MyResponse(False, reason=f"Couldn't find asset with id {asset_id}", status=404).to_json()

    asset_state = get_section_state(user, asset_id)
    if not asset_state:
        return MyResponse(True, {'result': None}).to_json()
    
    quizes = asset_state['quizes']  # dict of {(doc) asset_id: (quiz) asset_id}
    quiz_ids = [v for _, v in quizes.items()] + ([asset_state['sectionQuiz']] if 'sectionQuiz' in asset_state else [])
    activity = get_aggregated_activity(user, None, [user.user_id], quiz_ids, db=db)
    db.close()
    return MyResponse(True, {'result': asset_state, 'activity': activity}).to_json()


class Section(Folder):
    def __init__(self) -> None:
        super().__init__()
        self.chattable = True
        self.summarizable = True
        self.make_retriever_on_upload = False
        self.code = "section"
