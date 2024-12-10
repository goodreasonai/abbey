import json
from flask import (
    Blueprint,
    request,
    send_file
)
from flask_cors import cross_origin
from ..auth import User, token_required
from ..db import needs_db
from ..template_response import MyResponse
from ..integrations.lm import LM_PROVIDERS, LM, LONG_CONTEXT_CHAT_MODEL
from ..configs.str_constants import USER_TEXT_EDITOR_PROMPTS, DIVIDER_TEXT
import json
from .template import Template
from ..storage_interface import upload_asset_file
from ..asset_actions import get_asset, get_sources, get_or_create_retriever, set_sources, replace_asset_resource, add_asset_resource
from ..prompts.editor_prompts import get_editor_continue_system_prompt, get_editor_continue_chunks_preamble, get_editor_continue_chunks_text, get_editor_continue_conclusion, get_editor_continue_preamble, get_editor_outline_preamble, get_editor_outline_conclusion
from ..retriever import Retriever
from ..configs.str_constants import MAIN_FILE 
from ..utils import get_token_estimate
from ..user import get_user_metadata, set_user_metadata


bp = Blueprint('text-editor', __name__, url_prefix="/text-editor")


def get_text(user, asset_id):
    te = TextEditor()
    path = te.get_file(user, asset_id, ret_resp=False)
    with open(path, 'r') as fhand:
        return fhand.read()


# Note that this is also used for documents that have text files
@bp.route('/save', methods=('POST',))
@cross_origin()
@token_required
def save_file(user: User):

    id = request.json.get("id")
    html_str = request.json.get('html_str')
    ext = request.json.get('ext', 'html')
    name = request.json.get('name', MAIN_FILE)
    res = get_asset(user, id, needs_edit_permission=True)
    if not res:
        return MyResponse(False, reason="No asset found", status=404).to_json()

    asset_id = res['id']
    asset_title = res['title']

    path, from_key = upload_asset_file(asset_id, None, ext, use_data=html_str)
    replace_asset_resource(asset_id, name, from_key, path, asset_title)

    return MyResponse(True, { 'html_str': html_str }).to_json()
    

@bp.route('/prompts', methods=('GET',))
@cross_origin()
@token_required
def get_editor_prompts(user: User):
    default_prompts = [
        {
            'preamble': get_editor_continue_preamble(),
            'conclusion': get_editor_continue_conclusion(),
            'name': 'Default'
        },
        {
            'preamble': get_editor_outline_preamble(),
            'conclusion': get_editor_outline_conclusion(),
            'name': 'Outline'
        }
    ]
    up_meta_list = get_user_metadata(user, key=USER_TEXT_EDITOR_PROMPTS)
    if not len(up_meta_list):
        user_prompts = []
    else:
        user_prompts = json.loads(up_meta_list[0]['value'])
    return MyResponse(True, {'default_prompts': default_prompts, 'user_prompts': user_prompts}).to_json()


@bp.route('/set-prompts', methods=('POST',))
@cross_origin()
@token_required
def set_editor_prompts(user: User):
    prompts = request.json.get('prompts')
    set_user_metadata(user, USER_TEXT_EDITOR_PROMPTS, json.dumps(prompts), replace=True)
    return MyResponse(True, {'result': prompts}).to_json()


@bp.route('/continue', methods=('POST',))
@cross_origin()
@token_required
def ai_continue(user: User):
    asset_id = request.json.get('id')
    asset_row = get_asset(user, asset_id)
    if not asset_row:
        return MyResponse(False, reason="Couldn't find asset", status=404).to_json()
    
    exclude = request.json.get('exclude', [])
    context = request.json.get('context')
    include_self = request.json.get('include_self')
    user_system_prompt = request.json.get('system_prompt')
    user_system_prompt_kwargs = {'preamble': user_system_prompt['preamble'], 'conclusion': user_system_prompt['conclusion']} if user_system_prompt else {}

    lm: LM = LM_PROVIDERS[LONG_CONTEXT_CHAT_MODEL]

    system_prompt = ""

    if include_self:
        from .templates import get_template_by_code
        asset_resources = []
        tmp: Template = get_template_by_code(asset_row['template'])
        asset_resources.extend(tmp.get_asset_resources(user, asset_row['id']))
        mixed_ret: Retriever = get_or_create_retriever(user, asset_row, asset_resources, 'retriever')        
        chunks = mixed_ret.max_chunks(lm, context=context)  # suitable chunks for long context
        system_prompt = get_editor_continue_system_prompt(chunks=chunks, **user_system_prompt_kwargs)
    else:
        sources = get_sources(user, asset_id)
        if len(sources):
            from .templates import get_template_by_code
            asset_resources = []
            for source in sources:
                if source['id'] not in exclude and source['id'] != asset_id:
                    tmp: Template = get_template_by_code(source['template'])
                    asset_resources.extend(tmp.get_asset_resources(user, source['id']))
            mixed_ret: Retriever = get_or_create_retriever(user, asset_row, asset_resources, 'mixed')        
            chunks = mixed_ret.max_chunks(lm, context=context)  # suitable chunks for long context
            system_prompt = get_editor_continue_system_prompt(chunks=chunks, **user_system_prompt_kwargs)
        else:
            system_prompt = get_editor_continue_system_prompt(**user_system_prompt_kwargs)
    
    def stream_ai():
        for x in lm.stream(context, system_prompt=system_prompt):
            yield x + DIVIDER_TEXT

    return stream_ai()

# The main barrier to export-as-pdf is that it requires a massive install
"""
@bp.route('/export-as-pdf', methods=('POST',))
@cross_origin()
@token_required
def ai_continue(user: User):
    html = request.json.get('html')
    # TODO: sanitize HTML

    infile = tempfile.NamedTemporaryFile(delete=False, suffix=".html")
    outfile = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
    try:
        with open(infile.name, "w") as fhand:
            fhand.write(html)
        pdfkit.from_file(infile.name, outfile.name)
    finally:
        os.remove(infile)
    response = send_file(outfile.name, mimetype="application/pdf", download_name="download.pdf")
    response.headers['Access-Control-Expose-Headers'] = 'Content-Disposition'
    return response
"""


@bp.route('/restyle-export', methods=('POST',))
@cross_origin()
@token_required
def restyle_export(user: User):
    css = request.json.get('css')
    id = request.json.get('id')
    asset_row = get_asset(user, id)
    if not asset_row:
        return MyResponse(False, reason="No asset found", status=404).to_json()
    
    txt = get_text(user, id)
    
    full_html = f"""
    <html>
    <head><title>{asset_row['title']}</title><style>{css}</style></head>
    <body>{txt}</body>
    </html>
    """
    return MyResponse(True, {'result': full_html}).to_json()


class TextEditor(Template):
    def __init__(self) -> None:
        super().__init__()
        self.chattable = True
        self.summarizable = True
        self.code = "text_editor"
        self.make_retriever_on_upload = False

    @needs_db
    def upload(self, user: User, asset_id, is_editing, asset_title="", using_auto_title=False, using_auto_desc=False, no_commit=True, db=None):
        text = request.form.get('text', "This is your document. There are many like it, but this one is yours!")
        # Make default text
        path, from_key = upload_asset_file(asset_id, None, 'html', use_data=text)
        add_asset_resource(asset_id, MAIN_FILE, from_key, path, asset_title, no_commit=no_commit, db=db)

        # set sources
        selections = request.form.get('selections')
        if selections:
            selections = json.loads(selections)
            set_sources(user, asset_id, selections, db=db, no_commit=True)

        return True, asset_id
