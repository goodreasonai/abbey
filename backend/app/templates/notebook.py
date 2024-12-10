from .template import Template
from ..db import needs_db, get_db, with_lock, needs_special_db
from ..auth import User, token_required, token_optional
from flask_cors import cross_origin
from flask import Blueprint, request
from ..template_response import MyResponse
from ..asset_actions import (
    get_asset, set_sources, get_asset_metadata, save_asset_metadata,
    get_assets, has_asset_title_been_updated, mark_asset_title_as_updated,
    upload_asset
)
from ..configs.str_constants import ASSET_STATE
import json
from ..prompts.notebook_prompts import (
    get_key_points_system_prompt, get_key_points_user_prompt,
    get_outline_system_prompt, get_outline_user_prompt, make_title_system_prompt
)
from datetime import datetime
import math
from ..storage_interface import make_synthetic_resource
import sys
from flask_socketio import Namespace, emit, join_room, leave_room, rooms
import hashlib
from ..utils import text_from_html, get_token_estimate, get_current_utc_time
from ..integrations.lm import LM, LM_PROVIDERS, FAST_CHAT_MODEL
from ..configs.user_config import APP_NAME
from ..prompts.prompt_fragments import get_basic_ai_identity, get_citation_prompt
from ..utils import get_unique_id

bp = Blueprint('notebook', __name__, url_prefix="/notebook")


class BlockType():
    def __init__(self, code, has_text, has_sources, needs_sources) -> None:
        self.has_text = has_text
        self.has_sources = has_sources
        self.needs_sources = needs_sources
        self.code = code
    
    def get_text(self, block):
        raise Exception(f"Block type {self.code} does not have text")
    
    # Required even if has_text is false.
    def get_text_for_outline(self, block):
        raise Exception("Get text for outline not implemented")

    def get_sources(self, block):
        raise Exception(f"Block type {self.code} does not have sources")
    
    def update_sources(self, block, new_sources):
        raise Exception(f"Block type {self.code} does not have sources")
    
    def get_string_for_hash(self, block):
        return json.dumps(block, sort_keys=True)
    
    
class NoteBlock(BlockType):
    def __init__(self) -> None:
        super().__init__('note', True, False, False)

    def get_text(self, block):
        # Need to remove images from the html
        if not block['data']['html']:
            return ""
        text = text_from_html(block['data']['html'])
        return text
    
    def get_text_for_outline(self, block):
        return self.get_text(block)


class AssetBlock(BlockType):
    def __init__(self) -> None:
        super().__init__('asset', False, True, True)

    def get_sources(self, block):
        return [block['data']['assetRow']]
    
    def update_sources(self, block, new_sources):
        if not len(new_sources):
            return block
        assert(len(new_sources) == 1)
        return {**block, 'data': {**block['data'], 'assetRow': new_sources[0]}}
    
    def get_text_for_outline(self, block):
        return f"[{block['data']['assetRow']['title']}](link)"
    
    def get_string_for_hash(self, block):
        return "[" + json.dumps({**block['data'], 'assetRow': block['data']['assetRow']['id']}, sort_keys=True) + "]"


class AIBlock(BlockType):
    def __init__(self) -> None:
        super().__init__('ai', True, False, False)

    def get_text(self, block):
        full_text = ""
        data = block['data']
        if 'user' in data:
            full_text += data['user'] + "\n\n"
        if 'ai' in data:
            full_text += data['ai']
        return full_text
    
    def get_text_for_outline(self, block):
        return self.get_text(block)


BLOCK_TYPES = [NoteBlock(), AssetBlock(), AIBlock()]
def get_block_by_type(code):
    for x in BLOCK_TYPES:
        x: BlockType
        if x.code == code:
            return x
    raise Exception(f"Block with type '{code}' not found")


# There's a frontend analog of this function
def make_block(type, data, author, reply_to):
    block_type = get_block_by_type(type)
    
    
    if not block_type:
        raise Exception(f'Type {type} not in allowed block types')
    
    return {
        'type': type,
        'timestamp': get_current_utc_time(),  # Ideally should be in user's timezone TODO
        'id': get_unique_id(),
        'author': author if author else 'Me',
        'data': data,
        'replyTo': reply_to
    }


# There's a frontend analog
def get_notebook_state(
        blocks=[],
        keyPoints={
            'bullets': [],
            'numBlocks': 0,
            'timestamp': get_current_utc_time()
        },
        outline={
            'outline': [],
            'numBlocks': 0,
            'timestamp': get_current_utc_time()
        }   
    ):

    return {
        'blocks': blocks,
        'keyPoints': keyPoints,
        'outline': outline
    }


def hash_state(state):
    if state is None:
        return "None"
    hash_strings = {}
    for x in state:
        if x == 'blocks':
            hash_strings['blocks'] = []
            for block in state['blocks']:
                bltype =  get_block_by_type(block['type'])
                hash_str = bltype.get_string_for_hash(block)
                hash_strings['blocks'].append(hash_str)
        else:
            hash_strings[x] = json.dumps(state[x], sort_keys=True)
    state_str = json.dumps(hash_strings, sort_keys=True)
    return hashlib.sha256(state_str.encode('utf-8')).hexdigest()


# no_update determines whether get_notebook will try to update the sources (sometimes not important)
@needs_db
def get_notebook(user: User, asset_id, no_update=False, db=None):
    results, _ = get_asset_metadata(user, asset_id, [ASSET_STATE], get_total=False, db=db, no_commit=True)
    if not results or not len(results):
        return None
    
    res = json.loads(results[0]['value'])

    # Update asset manifests for potentially updated assets
    if not no_update:
        blocks = res['blocks']
        to_update = []
        for i in range(len(blocks)):
            block_type: BlockType = get_block_by_type(blocks[i]['type'])
            if block_type.has_sources:
                to_update.extend(block_type.get_sources(blocks[i]))
        
        if len(to_update):
            new_blocks = []
            updated_assets = get_assets(user, [x['id'] for x in to_update], db=db, no_commit=True)
            for block in blocks:
                block_type: BlockType = get_block_by_type(block['type'])
                if block_type.has_sources:
                    block_src_ids = [x['id'] for x in block_type.get_sources(block)]
                    new_sources = [src for src in updated_assets if src['id'] in block_src_ids]
                    if len(new_sources) or not block_type.needs_sources:
                        new_block = block_type.update_sources(block, new_sources)
                        new_blocks.append(new_block)
                else:
                    new_blocks.append(block)

            res['blocks'] = new_blocks
            
    return res

@needs_special_db(exclusive_conn=True)
def save_notebook_socket(user: User, asset_id, val, prev_hash, db=None):
    
    def callback(data):
        emit('save_response', data)

    if not asset_id:
        callback({'status': 'failed', 'reason': 'Missing asset id'})
        return
    if not val:
        callback({'status': 'failed', 'reason': 'Missing value'})
        return
    
    asset_row = get_asset(user, asset_id, needs_edit_permission=True)
    if not asset_row:
        return MyResponse(False, reason=f"Cannot find asset with id {asset_id}").to_json()

    @with_lock(f'nb_save_{asset_id}', db=db)
    def do_save():
        # Check previous version / hash TODO
        res = get_notebook(user, asset_id, db=db)  # don't need latest versions of assets honestly tho
        hashed = hash_state(res) if res else ""

        if hashed and prev_hash != hashed:
            callback({'status': 'failed', 'value': res, 'hash': hashed})
            return

        # Go through blocks in val and pick out assets to set sources
        source_ids = []
        for block in val['blocks']:
            block_type: BlockType = get_block_by_type(block['type'])
            if block_type.has_sources:
                source_ids.extend([x['id'] for x in block_type.get_sources(block)])

        set_sources(user, asset_id, source_ids, db=db, no_commit=True)

        save_asset_metadata(user, asset_id, ASSET_STATE, json.dumps(val), replace_all=True, db=db)  # commits
        hashed_val = hash_state(val)
        callback({'status': 'success', 'hash': hashed_val})
        # Send update to the room
        emit('value_update', {'value': val, 'hash': hashed_val}, include_self=False, room=str(asset_id))

    do_save()


# Has token control
# For key points / outline
# get text is function (block type, block) -> text
def get_block_texts_from_blocks(lm: LM, blocks, get_text, safety_ratio = .5):
    context_len = lm.context_length
    block_texts = []
    tot_tokens = 0
    for block in blocks[::-1]:
        block_type: BlockType = get_block_by_type(block['type'])
        spec_text = get_text(block_type, block)
        if spec_text:
            new_block_text = f"NOTE ID: {block['id']}\n{spec_text}"
            tot_tokens += get_token_estimate(new_block_text)
            if tot_tokens > safety_ratio * context_len:
                break
            block_texts = [new_block_text] + block_texts
    return block_texts


@bp.route('/get', methods=('GET',))
@cross_origin()
@token_optional
def get_notebook_endpoint(user: User):
    asset_id = request.args.get('id')
    if not asset_id:
        return MyResponse(False, reason="No id specified").to_json()
    asset_row = get_asset(user, asset_id)
    if not asset_row:
        return MyResponse(False, reason=f'Asset with id "{asset_id}" not found').to_json()
    
    res = get_notebook(user, asset_id)
    hashed = hash_state(res)
    
    return MyResponse(True, {'result': res, 'hash': hashed}).to_json()


@needs_db
def make_notebook(user: User, assets, db=None):
    success, msg = upload_asset(user, None, "Untitled", "", f"Workspace with {', '.join([x['title'] for x in assets])}", 'notebook', APP_NAME, False, db=db, no_commit=True)
    if not success:
        raise Exception(f"Making notebook failed with message: {msg}")
    new_asset_id = msg

    # Now I need to add asset blocks to the new workspace
    new_blocks = []
    for asset in assets:
        new_block = make_block('asset', {'assetRow': asset}, asset['author'], None)
        new_blocks.append(new_block)

    new_state = get_notebook_state(blocks=new_blocks)
    set_sources(user, new_asset_id, [x['id'] for x in assets], db=db, no_commit=True)
    save_asset_metadata(user, new_asset_id, ASSET_STATE, json.dumps(new_state), replace_all=True, db=db)  # commits

    return new_asset_id


@bp.route('/key-points', methods=('POST',))
@cross_origin()
@token_required
def key_points(user: User):
    asset_id = request.json.get('id')
    asset_row = get_asset(user, asset_id, needs_edit_permission=True)
    if not asset_row:
        return MyResponse(False, reason="No asset found", status=404).to_json()
    
    blocks = request.json.get('blocks')
    lm: LM = LM_PROVIDERS[FAST_CHAT_MODEL]

    def get_text(bl_type: BlockType, block):
        if bl_type.has_text:
            return bl_type.get_text(block)
        return None
    
    block_texts = get_block_texts_from_blocks(lm, blocks, get_text)
    system_prompt = get_key_points_system_prompt(block_texts)
    user_prompt = get_key_points_user_prompt()

    llm_text = lm.run(user_prompt, system_prompt=system_prompt, make_json=True)

    try:
        llm_json = json.loads(llm_text)
        bullet_json = llm_json['bullets']
    except ValueError:
        return MyResponse(False, reason="LLM returned non-JSON").to_json()

    data = {
        'bullets': bullet_json,
        'timestamp': datetime.now(),
        'numBlocks': len(blocks)
    }

    return MyResponse(True, {'result': data}).to_json()


# Doubles as a make-title endpoint for Workspace
@bp.route('/outline', methods=('POST',))
@cross_origin()
@token_required
def outline(user: User):
    asset_id = request.json.get('id')
    db = get_db()
    asset_row = get_asset(user, asset_id, needs_edit_permission=True, db=db)
    if not asset_row:
        return MyResponse(False, reason="No asset found", status=404).to_json()
    
    blocks = request.json.get('blocks')
    lm: LM = LM_PROVIDERS[FAST_CHAT_MODEL]

    block_texts = get_block_texts_from_blocks(lm, blocks, lambda x,y: x.get_text_for_outline(y))
    
    system_prompt = get_outline_system_prompt(block_texts)
    # Arbitrary formula, but seems about right (see desmos plot)
    user_prompt = get_outline_user_prompt(max_n=(int(len(blocks) / (.5 * math.sqrt(len(blocks))))))

    llm_text = lm.run(user_prompt, system_prompt=system_prompt, make_json=True)

    try:
        llm_json = json.loads(llm_text)
        outline_json = llm_json['outline']
    except ValueError:
        return MyResponse(False, reason="LLM returned non-JSON").to_json()

    # See if we can make a title for the Workspace
    # Will abort if asset's already been edited
    new_title_data = {}
    has_been_edited = has_asset_title_been_updated(asset_id, db=db)
    if not has_been_edited:
        new_title_str = lm.run("\n".join(block_texts), system_prompt=make_title_system_prompt(), make_json=True)
        new_title = None
        try:
            new_title_json = json.loads(new_title_str)
            new_title = new_title_json['title']
        except:
            print(f"Make title failed for notebook; model replied: {new_title_str}", file=sys.stderr)
        
        if new_title:
            sql = """
                UPDATE assets SET `title`=%s WHERE `id`=%s
            """
            curr = db.cursor()
            curr.execute(sql, (new_title, asset_id))
            mark_asset_title_as_updated(user, asset_row['id'], db=db)
            new_title_data['new_title'] = new_title

    data = {
        'result': {
            'outline': outline_json,
            'timestamp': datetime.now(),
            'numBlocks': len(blocks)
        },
        **new_title_data
    }

    return MyResponse(True, data).to_json()



class Notebook(Template):
    def __init__(self) -> None:
        super().__init__()
        self.chattable = True
        self.summarizable = True
        self.code = "notebook"

    @needs_db
    def get_asset_resources(self, user: User, asset_id, exclude=[], db=None):
        # Get combined asset retrieval sources and notes
        exclude_notes = []
        exclude_assets = []
        for x in exclude:
            i = x.find(':') if type(x) == type("") else -1
            if i >= 0:  # should always be the case ...
                exclude_notes.append(x[i+1:])
            else:
                # It's just an asset id
                exclude_assets.append(x)
            

        attached_resources = super()._get_asset_resources_include_retrieval_sources(user, asset_id, exclude=exclude_assets, db=db, no_commit=True)
        notebook = get_notebook(user, asset_id, db=db, no_commit=True)

        # We pass notes to exclude as "note:id"
        if notebook and 'blocks' in notebook:
            text = ""
            for block in notebook['blocks']:
                block_type: BlockType = get_block_by_type(block['type'])
                if block_type.has_text and block['id'] not in exclude_notes:
                    text += block_type.get_text(block) + "\n\n"
            if text:
                synth = make_synthetic_resource(asset_id, 'Notebook', text)
                attached_resources.append(synth)
        
        return attached_resources


    def build_chat_system_prompt(self, question, sources, extra_instructions="", src_title="", source_names=None):
        if source_names:
            assert(len(source_names) == len(sources))

        prompt = f"{get_basic_ai_identity()} A user is asking questions related to a notebook. Below are parts of the notebook."
        for i, source in enumerate(sources):
            source_name = ""
            if source_names:
                source_name = " " + source_names[i]

            prompt += f"*EXCERPT from {source_name}*\n"
            prompt += source
            prompt += f"\n*END of{' FINAL' if i == len(sources) - 1 else ''} EXCERPT*\n\n"

        prompt += "These excerpts may help you answer the user's question. Remember to BE CONCISE in your response.\n"
        prompt += get_citation_prompt(include_warning=False)  # include warning false so that it's a bit more forgiving than other templates when the answer isn't contained in the workspace

        return prompt

    def process_collab_action(self, user, asset_row, action_type, action_data):
        if action_type == 'save':
            asset_id = asset_row['id']
            val = action_data['value']
            prev_hash = action_data['last_saved_hash']
            save_notebook_socket(user, asset_id, val, prev_hash)
        else:
            print(f"Action type {action_type} unrecognized", file=sys.stderr)
