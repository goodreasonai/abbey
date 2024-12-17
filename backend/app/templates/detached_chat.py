
from flask import (
    Blueprint,
    request
)

from ..asset_actions import get_asset, has_asset_title_been_updated, mark_asset_title_as_updated, has_asset_desc_been_updated, make_retriever
from .template import Template
import json
from ..auth import User, token_required
from ..db import needs_db, get_db
from ..prompts.detached_chat_prompts import pure_detached_chat_system_prompt, make_title_system_prompt
from flask_cors import cross_origin
from ..template_response import MyResponse
from ..integrations.lm import LM, LM_PROVIDERS, FAST_CHAT_MODEL
import sys
from ..configs.str_constants import CHAT_CONTEXT
from ..worker import task_new_desc
import pickle


bp = Blueprint('detached-chat', __name__, url_prefix="/detached-chat")


@bp.route('/make-title', methods=('POST',))
@cross_origin()
@token_required
def make_title(user: User):

    asset_id = request.json.get('id')
    txt = request.json.get('txt')

    asset_row = get_asset(user, asset_id, needs_edit_permission=True)
    if not asset_row:
        return MyResponse(False, reason="Asset not found").to_json()

    # Will abort if asset's already been edited
    has_been_edited = has_asset_title_been_updated(asset_id)
    if has_been_edited:
        return MyResponse(True, {'title': asset_row['title']}).to_json()

    lm: LM = LM_PROVIDERS[FAST_CHAT_MODEL]
    new_title = lm.run(txt, system_prompt=make_title_system_prompt()).replace("\"", "")

    sql = """
        UPDATE assets SET `title`=%s WHERE `id`=%s
    """
    db = get_db()
    curr = db.cursor()
    curr.execute(sql, (new_title, asset_id))

    mark_asset_title_as_updated(user, asset_row['id'], db=db)
    db.commit()  # should already be done by the mark_asset_title_as_updated call

    return MyResponse(True, {'title': new_title}).to_json()


# This would ordinarily be triggered in a retriever, but detached chats do not use a retriever.
@bp.route('/make-description', methods=('POST',))
@cross_origin()
@token_required
def make_Description(user: User):

    asset_id = request.json.get('id')

    asset_row = get_asset(user, asset_id, needs_edit_permission=True)
    if not asset_row:
        return MyResponse(False, reason="Asset not found").to_json()

    ret = make_retriever(user, asset_row, 'retriever')
    sret = ret.resource_retrievers[0]
    if sret:
        has_been_edited = has_asset_desc_been_updated(asset_id, new_conn=True)
        if not has_been_edited:
            task_new_desc.apply_async(args=[pickle.dumps(sret)])

        # Start description job
        return MyResponse(True).to_json()
    else:
        return MyResponse(False, reason="Couldn't make retriever").to_json()


class DetachedChat(Template):
    def __init__(self) -> None:
        super().__init__()
        self.chattable = True
        self.summarizable = True
        self.code = "detached_chat"
        self.metadata_non_user_specific = [CHAT_CONTEXT]
        self.metadata_modify_with_edit_perm = [CHAT_CONTEXT]

    @needs_db
    def get_asset_resources(self, user: User, asset_id, exclude=[], db=None):
        
        # Return a synthetic resource
        # This is somewhat dependent on the schema of asset_resources

        asset_row = get_asset(user, asset_id)
        if not asset_row:
            return []

        curr = db.cursor()
        sql = """
        SELECT * FROM asset_metadata
        WHERE `user_id`=%s AND `key`=%s AND `asset_id`=%s
        """
        curr.execute(sql, [user.user_id, CHAT_CONTEXT, asset_id])
        res = curr.fetchone()
        
        if not res:
            return []
                
        val = res['value']
        convo = json.loads(val)
        try:
            synthetic = "\n\n".join([f"User: {x['user']}\n\nAI: {x['ai']}" for x in convo if 'ai' in x and x['ai']])
        except:
            # Just worred about chat context changing keys / leaving out keys
            print("Synethic chat context could not be created", file=sys.stderr)
            return []
        
        if not synthetic:
            synthetic = "(No previous chat)"
        
        # There is a really strong and unfortunate dependence on schema here.
        # We may want to, at some point, create some special datatype for these things.
        return [{'id': -1,
                 'asset_id': asset_id,
                 'name': 'main',
                 'from': 'synthetic',
                 'path': synthetic,
                 'time_uploaded': res['time_uploaded'],
                 'title': asset_row['title']}]

    def build_chat_system_prompt(self, question, sources, extra_instructions="", src_title="", source_names=None):
        return pure_detached_chat_system_prompt()
    
    def build_detached_chat_system_prompt(self):
        return pure_detached_chat_system_prompt()
