from datetime import datetime, timedelta
from flask import (
    Blueprint,
    request,
    send_file
)
import os
from flask_cors import cross_origin
from .exceptions import RetrieverEmbeddingsError, UserIsNoneError
import sys
from .jobs import get_job, search_for_jobs, start_job, get_job_resource, delete_job
from .configs.str_constants import *
from .configs.user_config import RETRIEVER_JOB_TIMEOUT
from .integrations.lm import DEFAULT_CHAT_MODEL, FAST_LONG_CONTEXT_MODEL, FAST_CHAT_MODEL, BALANCED_CHAT_MODEL
from .db import get_db
from .template_response import MyResponse
from .retriever import Chunk, Retriever
from .batch_and_stream_lm import stream_multiplexed_batched_lm
from .integrations.lm import LM_PROVIDERS, LM, get_safe_retrieval_context_length
from .auth import User, token_optional, token_required, get_permissioning_string
import json
from .templates.templates import get_template_by_code, TEMPLATES
from .templates.template import Template
from .storage_interface import download_file
from .reducer import Reducer
from .asset_actions import (
    get_asset, make_retriever, set_sources,
    make_retriever_job, mark_asset_title_as_updated, mark_asset_desc_as_updated, upload_asset,
    get_asset_metadata, get_permissions, save_chat, set_asset_permissions,
    search_assets, propagate_joint_permissions, get_sources, delete_asset,
    suggest_questions, get_assets, start_summary_apply_job, start_summary_reduce_job,
    get_book_order, set_book_order, get_asset_resource, add_resource_from_text
)
from .user import get_user_chat_model_code, get_user_templates, get_user_allowed_new_upload, inc_upload_counter
from concurrent.futures import ThreadPoolExecutor
from .activity import make_log
import tempfile
import os
from .worker import task_apply, task_general
import pickle
from .interasset import InterAssetRetriever
from .groups import get_group, search_groups
from .prompts.recommendation_prompts import get_chosen_group_prompt, get_chosen_group_system_prompt
from .web import get_web_chunks
from .prompts.web_search_prompts import get_web_query_system_prompt
from .prompts.summary_prompts import get_quick_summary_prompt, get_key_points_user_prompt
from .auth import get_users
from .utils import quick_tok_estimate
from .integrations.auth import FullUser


bp = Blueprint('assets', __name__, url_prefix="/assets")

DEFAULT_SEARCH_LIMIT = 20  # not in user config because rarely needed


# Basically like a search endpoint
# Permissioned
@bp.route('/manifest', methods=('GET',))
@token_optional
@cross_origin()
def manifest(user: User):

    search = request.args.get('search')
    if not search:
        search = ""

    limit = request.args.get("limit")
    if not limit:
        limit = 20

    offset = request.args.get("offset")
    if not offset:
        offset = 0

    recent_activity = request.args.get("recent_activity")  # 0 or 1
    if recent_activity == '0':
        recent_activity = False

    my_uploads = request.args.get("my_uploads")  # If true, then turns into "my uploads" endpoint
    only_templates = request.args.get("only_templates")  # specifies list of allowed templates to return
    only_templates = json.loads(only_templates) if only_templates else None
    sub_manifest = request.args.get('sub_manifest')
    folders_first = request.args.get('folders_first')
    
    # Groups: A bit of a mess
    group_id = request.args.get('group_id')  # include stuff from only this group, and no other assets
    include_groups = request.args.get('include_groups')  # include stuff from any group
    if not include_groups or int(include_groups) == 0:
        include_groups = False
    else:
        include_groups = True

    exclude_ids = request.args.get('exclude_ids')
    if not exclude_ids:
        exclude_ids = []
    else:
        exclude_ids = json.loads(exclude_ids)
    
    include_group_ids = request.args.get('include_group_ids')  # include stuff from these groups + other non grouped assets
    if include_group_ids:
        include_group_ids = json.loads(include_group_ids)

    # Tagging for groups
    filter_tags_on_groups = request.args.get('filter_tags_on_groups')  # JSON object of group id -> object like {'tag': false}
    # NOTE: We *include* those tags without an entry
    if filter_tags_on_groups:
        filter_tags_on_groups = json.loads(filter_tags_on_groups)

    alphabetical = request.args.get('alphabetical')
    if not alphabetical or int(alphabetical) == 0:
        alphabetical = False
    else:
        alphabetical = True

    isolated = request.args.get('isolated')  # Only gets assets that are explicitly permissioned for you or created by you, except for when it's recent activity
    if isolated == '0':
        isolated = False

    needs_edit_permission = request.args.get('edit')
    if not needs_edit_permission or int(needs_edit_permission) == 0:
        needs_edit_permission = False
    else:
        needs_edit_permission = True

    get_total = request.args.get('get_total')
    if not get_total or int(get_total) == 0:
        get_total = False
    else:
        get_total = True

    try:
        # The total is ignored by default, actually.
        results, total = search_assets(user, search=search, limit=limit,
                                    offset=offset, only_templates=only_templates, include_purchased_groups=False,
                                    recent_activity=recent_activity, sub_manifest=sub_manifest,
                                    group_ids=[group_id] if group_id else [], my_uploads=my_uploads, isolated=isolated,
                                    folders_first=folders_first, include_groups=include_groups, include_group_ids=include_group_ids,
                                    alphabetical=alphabetical, filter_tags_on_groups=filter_tags_on_groups, ignore_total=(not get_total),
                                    needs_edit_permission=needs_edit_permission, exclude_ids=exclude_ids, exclusive_conn=get_total)

    except UserIsNoneError:
        print("User is none error in /manifest; ignoring.", file=sys.stderr)
        results, total = [], 0
    
    return MyResponse(True, {'results': results, 'total': total}).to_json()


# doubles as edit endpoint
@bp.route('/upload', methods=('POST',))
@cross_origin()
@token_required
def upload(user: User):

    # Universally relevant
    title = request.form.get("title")
    template = request.form.get("template")
    author = request.form.get("author")
    preview_desc = request.form.get("preview_desc")
    llm_description = request.form.get("lm_desc")

    using_auto_title = request.form.get('using_auto_title')
    using_auto_desc = request.form.get('using_auto_desc')

    permissions = request.form.get('permissions')
    permissions = json.loads(permissions)

    group_id = request.form.get('group')

    asset_id = request.form.get('id')

    if not llm_description:
        llm_description = preview_desc
    if not title:
        return MyResponse(False, reason="Missing title", status=400).to_json()
    if not preview_desc:
        return MyResponse(False, reason="Missing preview_desc", status=400).to_json()
    if not template:
        return MyResponse(False, reason="Missing template", status=400).to_json()
    if not author:
        return MyResponse(False, reason="Missing author", status=400).to_json()

    # Make sure user has permission to upload a type of asset
    allowed_templates = get_user_templates(user)
    if template not in allowed_templates:
        return MyResponse(False, reason="User not allowed to upload this template.", status=403).to_json()

    db = get_db()

    # Make sure user is allowed to upload another asset
    allowed = get_user_allowed_new_upload(user, db=db)
    if not allowed:
        return MyResponse(False, reason="You have run out of free uploads. Upgrade in Settings for more.", status=403).to_json()

    # if user is adding to a group, make sure the user has edit permissions on the group
    if group_id is not None:
        group = get_group(user, group_id, needs_edit_permission=True)
        if not group:
            return MyResponse(False, reason=f"Group {group_id} not found", status=404).to_json()

    ok, message = upload_asset(user, asset_id, title, llm_description, preview_desc, template, author, group_id=group_id, no_commit=True, db=db)

    if not ok:
        return MyResponse(False, reason=message).to_json()

    # Template specific
    tmp: Template = get_template_by_code(template)
    ok, tmp_message = tmp.upload(user, message, asset_title=title, using_auto_desc=using_auto_desc, using_auto_title=using_auto_title, db=db, no_commit=True)

    # On the same connection, this should be OK
    asset_row = get_asset(user, message, db=db, no_commit=True)

    if not ok:
        # Very hard to guarantee that no_commit is being followed given the connection pool situation
        # You may wonder about things like metadata, tags, etc.
        if asset_row:
            # We really want the user to see the proper error, so we'll wrap a try catch here
            try:
                delete_asset(asset_row, db=db)
            except Exception as e:
                print(f"Error trying to delete asset after error: {e}", file=sys.stderr)
                
        return MyResponse(False, reason=tmp_message).to_json()

    # Upload permissions, and joint permissions where appropriate.
    # important for joint permissions that this is after template specific.
    set_asset_permissions(user, message, email_domains=permissions['emailDomains'], edit_domains=permissions['editDomains'], public=permissions['public'], additive=True, email_on_share=True, asset_row=asset_row, db=db, no_commit=True)

    if not using_auto_title:
        mark_asset_title_as_updated(user, message, db=db, no_commit=True)
    
    if not using_auto_desc:
        mark_asset_desc_as_updated(user, message, db=db, no_commit=True)

    db.commit()

    # Basically done like this for legacy reasons.
    resp = MyResponse(True, {'asset_id': message, 'asset_row': asset_row}).to_json()

    metadata = {'title': title, 'template': template, 'author': author,
    'preview_desc': preview_desc, 'llm_desc': llm_description, 'permissions': permissions}
    make_log(user, asset_id, request.remote_addr, UPLOAD_EDIT_ACTIVITY, json.dumps(metadata))

    # "Charge" user for an upload (increment upload counter)
    inc_upload_counter(user, template)

    # Pre build text on upload
    if tmp.chattable and tmp.make_retriever_on_upload:
        job_id = start_job('Making retriever on upload', {}, message, MAKE_RETRIEVER, user.user_id)
        task_general.apply_async(args=[pickle.dumps(make_retriever_job), user.to_json(), job_id, asset_row], kwargs={'except_text': 'Failed to make retriever on upload'})

    return resp

@bp.route('/inline-edit', methods=('POST',))
@cross_origin()
@token_required
def inline_edit(user: User):
    db = get_db()
    curr = db.cursor()
    
    id = request.json.get('id')

    asset = get_asset(user, id, needs_edit_permission=True)
    if not asset:
        return MyResponse(False, reason="Could not find asset").to_json()

    title = request.json.get('title')
    author = request.json.get("author")
    preview_desc = request.json.get('preview_desc')

    fields_to_edit = [x for x in [('title', title), ('author', author), ('preview_desc', preview_desc)] if x[1]]
    assert(len(fields_to_edit) > 0)

    set_strs = [f'`{x[0]}`=%s' for x in fields_to_edit]
    sql = f"""
        UPDATE assets
        SET {','.join(set_strs)}
        WHERE `id`=%s
    """
    curr.execute(sql, (*[x[1] for x in fields_to_edit], id))
    
    if title != asset['title']:
        mark_asset_title_as_updated(user, id, db=db, no_commit=True)
    if preview_desc != asset['preview_desc']:
        mark_asset_desc_as_updated(user, id, db=db, no_commit=True)
    
    db.commit()

    confirmation = {x[0]: x[1] for x in fields_to_edit}

    return MyResponse(True, data=confirmation).to_json()

"""

Takes four JSON args:
- id, the asset id
- public, which is 1 or 0 or true or false
- email_domains, the email addresses / domains with viewing access
- edit_domains, the email addresses / domains with editing privileges

Domains may be duplicated among email_domains and edit_domains, but there will be only one DB entry per.

"""
@bp.route('/set-permissions', methods=('POST',))
@cross_origin()
@token_required
def set_permissions_(user: User):
    
    asset_id = int(request.json.get("id"))
    asset = get_asset(user, asset_id, needs_edit_permission=True)
    if not asset:
        return MyResponse(False, reason="You cannot edit permissions on this asset").to_json()

    public = request.json.get('public')
    assert(int(public) == 0 or int(public) == 1)

    edit_domains = request.json.get('edit_domains')
    email_domains = [x for x in request.json.get('email_domains') if x not in edit_domains]  # no need for duplicate entries

    set_asset_permissions(user, asset_id, email_domains=email_domains, edit_domains=edit_domains, email_on_share=True, asset_row=asset, public=public)

    return MyResponse(True).to_json()

@bp.route('/remove', methods=('POST',))
@cross_origin()
@token_required
def remove(user: User):
    from_id = request.json.get('from')
    id = request.json.get('id')

    asset_row = get_asset(user, from_id, needs_edit_permission=True)
    if not asset_row:
        return MyResponse(False, reason="You do not have permissions to do this").to_json()
    
    sql = """
    DELETE FROM asset_permissions
    WHERE `asset_id`=%s AND `joint_asset_id`=%s;
    """
    db = get_db(exclusive_conn=True)
    curr = db.cursor()
    curr.execute(sql, (id, from_id))
    
    propagate_joint_permissions(user, id, db=db)

    # The delete children is done after so that the propagate works as expected.

    sql = """
    DELETE FROM asset_metadata
    WHERE `key`=%s AND `asset_id`=%s AND `value`=%s;
    """
    curr = db.cursor()
    curr.execute(sql, (RETRIEVAL_SOURCE, from_id, id))

    db.close()

    return MyResponse(True).to_json()



@bp.route('/delete', methods=('POST',))
@cross_origin()
@token_required
def delete(user: User):
    db = get_db()
    asset_id = request.form.get('id')
    delete_contents = request.form.get('delete_contents')

    # Ensures proper permissions
    asset_dict = get_asset(user, asset_id, needs_edit_permission=True)
    if not asset_dict:
        return MyResponse(False, reason="Could not find asset", status=404).to_json()

    to_delete = [asset_dict]

    if delete_contents:
        resources = get_sources(user, asset_id, needs_edit_permission=True)
        to_delete.extend([x for x in resources if get_asset(user, x['id'], needs_edit_permission=True)])

    have_deleted_ids = {}
    for asset_row in to_delete:
        if asset_row['id'] in have_deleted_ids:
            continue
        delete_asset(asset_row, db=db, no_commit=True)
        have_deleted_ids[asset_row['id']] = True

    db.commit()

    metadata = {}
    make_log(user, asset_id, request.remote_addr, DELETE_ACTIVITY, json.dumps(metadata))

    return MyResponse(success=True).to_json()


# Return one row of assets
@bp.route('/manifest-row', methods=('GET',))
@token_optional
@cross_origin()
def manifest_row(user: User):

    id = request.args.get('id')
    try:
        id = int(id)
    except ValueError as e:
        return MyResponse(False).to_json()

    res = get_asset(user, id, append_can_edit=True)
    if not res:
        return MyResponse(False, reason="Couldn't find asset", status=404).to_json()
    return MyResponse(True, {'result': res}).to_json()


# NOTE: untested.
# Return potentially many rows of assets
@bp.route('/manifest-rows', methods=('GET',))
@token_optional
@cross_origin()
def manifest_rows(user: User):
    ids = request.args.getlist('id', type=int)
    results = get_assets(user, ids)
    if not results or not len(results):
        return MyResponse(False, reason="Couldn't find any assets", status=404).to_json()
    return MyResponse(True, {'results': results}).to_json()



@bp.route('/permissions', methods=('GET',))
@cross_origin()
@token_required
def permissions(user: User):
    id = request.args.get('id')
    asset_row = get_asset(user, id)
    if not asset_row:
        return MyResponse(False, reason="Could not get asset to check permissions of").to_json()

    perms = get_permissions(id, no_joints=False)
    real_perms = []
    joint_perms = []
    if not perms:
        real_perms = []
    else:
        for perm in perms:
            if perm['joint_asset_id']:
                joint_perms.append(perm)
            else:
                real_perms.append(perm)

    # any user_id permission should also have email
    user_ids_to_emails = {}
    user_ids_to_get = []
    for perm in [*real_perms, *joint_perms]:
        if perm['user_id'] and not perm['email_domain']:
            user_ids_to_get.append(perm['user_id'])
    
    if len(user_ids_to_get):
        users_info = get_users(user_ids=user_ids_to_get)
        user_ids_to_emails = {}
        for user in users_info:
            user: FullUser
            user_ids_to_emails[user.user_id] = user.email_address

    return MyResponse(True, {'results': real_perms, 'joints': joint_perms, 'user_ids_to_emails': user_ids_to_emails}).to_json()


@bp.route('/files', methods=('GET',))
@cross_origin()
@token_optional
def files(user: User):

    id = request.args.get("id")
    token = request.args.get("token")
    only_headers = request.args.get("only_headers")
    name = request.args.get('name', MAIN_FILE)

    try:
        id = int(id)
    except ValueError as e:
        return MyResponse(False).to_json()
    db = get_db()

    res = get_asset(user, id) if not token else get_asset(user, id, token=token)

    if not res:
        return MyResponse(False, reason=f"No asset found with id {id}", status=404).to_json()

    # According to template and args, return appropriate file, if non specified
    
    this_template: Template = get_template_by_code(res['template'])
    return this_template.get_file(user, id, only_headers=only_headers, name=name, db=db)


@bp.route('/metadata', methods=('GET',))
@cross_origin()
@token_optional
def get_metadata(user: User):
    id = request.args.get('id')  # asset id
    keys = request.args.getlist('key')
    
    limit = request.args.get('limit')
    if limit:
        limit = int(limit)
    offset = request.args.get('offset')
    if offset:
        offset = int(offset)
    try:
        id = int(id)
    except ValueError as e:
        return MyResponse(False).to_json()

    res, _ = get_asset_metadata(user, id, keys=keys, limit=limit, offset=offset)

    if res is None:
        res = []
    return MyResponse(True, {'results': res}).to_json()


@bp.route('/save-metadata', methods=('POST',))
@cross_origin()
@token_required
def save_metadata(user: User):
    # NOTE IMPORTANT: Some asset metadata can be sensitive. For example, permissions requests.
    # So we need to white list keys that users are allowed to modify or add.
    # White lists are tracked at the template level
    
    asset_id = request.json.get('id')
    key = request.json.get('key')
    value = request.json.get('value')
    additive = request.json.get('additive')
    delete = request.json.get('delete')
    delete_id = request.json.get('delete_id')

    asset = get_asset(user, asset_id)
    if not asset:
        return MyResponse(False, reason="No asset found, or you do not have edit permissions.", status=404).to_json()
    
    """
    Can user modify this key flow:

    Does the user have access to this asset?
        --> No: No
        --> Yes: Can the key be modified with edit permissions?
            --> Yes: Does the user have edit access?
                --> Yes: can edit
                --> No: can't edit
            --> No: Is it user specific?
                --> Yes: Can edit for that user
                --> No: Can't edit    
    """
    
    tmp: Template = get_template_by_code(asset['template'])
    if key not in tmp.metadata_modify_with_edit_perm:
        if key not in tmp.metadata_user_specific:
            return MyResponse(False, reason="You do not have permission to edit this key", status=403).to_json()
    else:
        if not get_asset(user, asset_id, needs_edit_permission=True):
            return MyResponse(False, reason="You do not have permission to edit this key", status=403).to_json()

    db = get_db()
    curr = db.cursor()

    if delete:
        if delete_id:
            sql = """
            DELETE FROM asset_metadata WHERE `asset_id`=%s AND `id`=%s AND `user_id`=%s
            """
            curr.execute(sql, (asset_id, delete_id, user.user_id))
        else:
            sql = """
            DELETE FROM asset_metadata WHERE `asset_id`=%s AND `key`=%s AND `user_id`=%s
            """
            curr.execute(sql, (asset_id, key, user.user_id))

        db.commit()

        return MyResponse(True).to_json()  # might be nice to return what was deleted, but don't want to make the user speicfy all the info or make another DB call.

    # We want to be careful about specifying not additive, which is a destructive action.
    if additive is None:
        additive = True

    true_user_id = user.user_id if user else None
    
    if not additive:
        # NOTE: this deletes all metadata associated with the key, regardless of owner.
        # Consider changing in the future if needs arise.
        sql = """
        DELETE FROM asset_metadata
        WHERE `asset_id`=%s AND `key`=%s AND `user_id`=%s
        """
        curr.execute(sql, (asset_id, key, user.user_id))

    sql = """
        INSERT INTO asset_metadata (`asset_id`, `key`, `value`, `user_id`)
        VALUES (%s, %s, %s, %s)
        """
    curr.execute(sql, (asset_id, key, value, true_user_id))

    result = {'asset_id': asset_id, 'key': key, 'value': value, 'user_id': true_user_id, 'id': curr.lastrowid}
    db.commit()

    return MyResponse(True, {'result': result}).to_json()


@bp.route('/save-chat', methods=('POST',))
@cross_origin()
@token_required
def save_chat_(user: User):
    id = request.json.get('id')
    try:
        id = int(id)
    except ValueError as e:
        return MyResponse(False, reason="Id not found", status=400).to_json()

    asset_row = get_asset(user, id)
    if not asset_row:
        return MyResponse(False, reason="No asset found to chat with.", status=404).to_json()

    context = request.json.get('context')
    saved_context = save_chat(user, asset_row, context)

    return MyResponse(True, {'context': saved_context}).to_json()


@bp.route('/chat', methods=('POST',))
@cross_origin()
@token_required
def chat(user: User):

    """

    Parameters:
    - id (asset id to chat with)
    - question (list of questions to answer, or a single question if not batched)
    - batched (are the questions batched - in this case, streaming must be true)
    - streaming (optional bool - should the response be streaming)

    questions are objects with: 
    - txt (required)
    - context (optional)
    - sources (optional)
    - source_names (optional)
    - extra_instructions (optional)

    """

    id = request.json.get('id')
    try:
        id = int(id)
    except ValueError as e:
        return MyResponse(False, reason="Id not found", status=400).to_json()

    asset_row = get_asset(user, id)
    if not asset_row:
        return MyResponse(False, reason="No asset found to chat with.", status=404).to_json()

    question = request.json.get('question')
    batched = request.json.get('batched')
    streaming = request.json.get('streaming')
    assert(streaming)  # can only hanlde streaming now
    detached = request.json.get('detached')
    use_web = request.json.get('use_web')
    temperature = request.json.get('temperature')
    exclude = request.json.get('exclude', [])
    user_time = request.json.get('user_time')

    if streaming is not None and not streaming and batched:
        return MyResponse(False, reason="Can't do non-streaming with batch.", status=400).to_json()

    template_object: Template = get_template_by_code(asset_row['template'])

    if not template_object.chattable:
        return MyResponse(False, reason="Chat not implemented for specified template", status=400).to_json()

    retriever = None
    if not detached:
        # Retriever gets tied to the asset id
        retriever: Retriever = make_retriever(user, asset_row, exclude=exclude)

        if not retriever:
            return MyResponse(False, reason="Could not get retriever").to_json()

    # Technically, everything is batched!
    if not batched:
        question = [question]

    if user:
        code = get_user_chat_model_code(user)
        model: LM = LM_PROVIDERS[code]
    else:
        model = LM_PROVIDERS[DEFAULT_CHAT_MODEL]

    def chat_response():
        prompts = []
        prompt_kwargs = []

        # This exists so that we can send the web search query before the other stuff
        def web_search(q):
            for_web_retrieval_response = []
            context = q['context'] if 'context' in q else []
            context = [x for x in context if x['ai'] and x['user']]  # remove questions with blank areas
            context_str = [f"User: {x['user']}\nAI: {x['ai']}" for x in context]
            if not detached:
                try:
                    for_web_retrieval_response = retriever.query(q['txt'], context=context_str, max_results=5)
                except RetrieverEmbeddingsError:
                    for_web_retrieval_response = []
            system_prompt = get_web_query_system_prompt(context, for_web_retrieval_response, user_time)
            lm: LM = LM_PROVIDERS[FAST_CHAT_MODEL]
            search_query: str = lm.run(q['txt'], system_prompt=system_prompt)
            search_query = search_query.replace("\"", "")  # Bing API can't do keyword searches, and sometimes ChatGPT wraps its responses in quotes.
            return search_query

        def process_question(q):
            context = q['context'] if 'context' in q else []
            context = [x for x in context if x['ai'] and x['user']]  # remove questions with blank areas
            context_n_tokens = quick_tok_estimate("\n".join([x['ai'] for x in context] + [x['user'] for x in context] + [q['txt']]))
            inline_citations = False

            if use_web:
                assert(q['search_query'])
                n_web_chunks = 5
                web_chunks = get_web_chunks(user, q['search_query'], available_context=(get_safe_retrieval_context_length(model) - context_n_tokens), max_n=n_web_chunks)
                system_prompt = template_object.build_web_chat_system_prompt(q['txt'], web_chunks)
                retrieval_sources_json = [x.to_json() for x in web_chunks]
                retrieval_sources = [x.txt for x in web_chunks]
                retrieval_sources_metadata = [{'type': 'web'} for _ in retrieval_sources]
                retrieval_source_names = [x.source_name for x in web_chunks]
                prompt = q['txt']
            elif detached:
                system_prompt = template_object.build_detached_chat_system_prompt()
                retrieval_sources_json = []
                retrieval_sources = []
                retrieval_sources_metadata = []
                retrieval_source_names = []
                inline_citations = True  # keeps sources from popping up underneath a chat in case detached gets changed.
                prompt = q['txt']
            else:
                assert('txt' in q)  # Every question must have a txt

                try:
                    max_retrieval_response = retriever.max_chunks(model, q['txt'], safe_context_length=(get_safe_retrieval_context_length(model) - context_n_tokens))
                except RetrieverEmbeddingsError:
                    max_retrieval_response = []

                # Now we use blank retrieval sources due to inline citations
                retrieval_sources = []
                retrieval_source_names = []
                retrieval_sources_metadata = []
                retrieval_sources_json = []
                inline_citations = True

                max_sources = [x.txt for x in max_retrieval_response]
                max_source_names = [x.source_name for x in max_retrieval_response]

                # use a different prompt for different templates
                prompt = template_object.build_chat_prompt(q['txt'], max_sources, src_title=asset_row['title'])
                system_prompt = template_object.build_chat_system_prompt(q['txt'], max_sources, src_title=asset_row['title'], source_names=max_source_names)
            
            new_kwargs = {
                'context': context,
                'sources': retrieval_sources,
                'source_names': retrieval_source_names,
                'source_metadata': retrieval_sources_metadata,
                'source_json': retrieval_sources_json,
                'system_prompt': system_prompt,
                'inline_citations': inline_citations
            }

            if temperature is not None:
                new_kwargs['temperature'] = temperature

            if 'images' in q and q['images'] and len(q['images']):
                new_kwargs['images'] = q['images']

            return prompt, new_kwargs

        prompts = []
        prompt_kwargs = []
        MAX_THREADS = 10

        if use_web:
            with ThreadPoolExecutor(max_workers=MAX_THREADS) as executor:
                results = list(executor.map(web_search, question))

            for i, search_query in enumerate(results):
                if search_query:
                    yield json.dumps({'index': i, 'search_query': search_query}) + DIVIDER_TEXT
                    question[i]['search_query'] = search_query

        with ThreadPoolExecutor(max_workers=MAX_THREADS) as executor:
            results = list(executor.map(process_question, question))

        for prompt, kwargs in results:
            prompts.append(prompt)
            prompt_kwargs.append(kwargs)

        for res in stream_multiplexed_batched_lm(prompts, kwargs_list=prompt_kwargs, model=model):
            yield res

    # May want to put this inside chat_response in the future so that we can collect the response. TODO
    metadata = {'questions': question}
    make_log(user, id, request.remote_addr, CHAT_ACTIVITY, json.dumps(metadata))

    return chat_response()


# Search over an asset's retriever chunks
@bp.route('/retriever-search', methods=('GET',))
@token_optional
@cross_origin()
def semantic_search(user: User):
    id = request.args.get('id')
    try:
        id = int(id)
    except ValueError as e:
        return MyResponse(False, reason="Id not found").to_json()
    txt = request.args.get('txt')
    if not txt:
        return MyResponse(True, {'results': []}).to_json()

    asset_row = get_asset(user, id)

    if not asset_row:
        return MyResponse(False, reason="No asset found with provided id").to_json()

    retriever = make_retriever(user, asset_row)

    if not retriever:
        return MyResponse(False, reason="Could not access retriever").to_json()

    found = retriever.search(txt)
    
    return MyResponse(True, {
        'results': [x.to_json() for x in found]
    }).to_json()



# Returns a job
@bp.route('/make-retriever', methods=('POST',))
@cross_origin()
@token_required
def make_retriever_endpoint(user: User):

    # If you add retriever options, you'll need to check with get_retriever_status to make sure it agrees
    id = request.json.get('id')
    force_ocr = request.json.get('force_ocr')

    asset_row = get_asset(user, id)
    if not asset_row:
        return MyResponse(False, reason="Asset not found.").to_json()

    # We use the job system here.
    # Perhaps make-applier should do the same... TODO

    db = get_db()
    job_id = start_job('Making retriever in make-retriever endpoint', {}, asset_row['id'], MAKE_RETRIEVER, user.user_id, db=db)

    job = get_job(job_id, asset_row['id'], db=db)  # A bit wasteful, but helps keep consistency in output.

    db.commit()

    response = MyResponse(True, {'retriever_job': job}).to_json()

    ret_options = {
        'force_ocr': force_ocr,
        'force_create': True
    }

    kwargs = {
        'except_text': 'Failed to make retriever using endpoint',
        'retriever_options': ret_options
    }
    
    task_general.apply_async(args=[pickle.dumps(make_retriever_job), user.to_json(), job_id, asset_row], kwargs=kwargs)

    return response


@bp.route('/get-retriever-status', methods=('POST',))
@cross_origin()
@token_optional
def get_retriever_status(user: User):
    id = request.json.get('id')

    asset_row = get_asset(user, id)
    if not asset_row:
        return MyResponse(False, reason="Asset not found.").to_json()

    db = get_db()
    results = search_for_jobs(kind=MAKE_RETRIEVER, asset_id=asset_row['id'], order_by=[['time_uploaded', False]], db=db)

    # Just send first one...
    for res in results:
        if not res['is_running'] and not res['is_complete']:
            # Last job failed
            break

        curr = db.cursor()
        curr.execute("SELECT NOW()")  # Using the database time to compare to the database time - timezones!
        now = curr.fetchone()['NOW()']

        now = datetime.strptime(now, "%Y-%m-%d %H:%M:%S")
        tu = datetime.strptime(res['time_uploaded'], "%Y-%m-%d %H:%M:%S")

        age = now - tu
        if res['is_running'] and age > timedelta(minutes=RETRIEVER_JOB_TIMEOUT):
            # Job timed out
            # NOTE: might want to clean that up here?
            break

        if res['is_running']:
            return MyResponse(True, {'retriever_job': res}).to_json()

    # No jobs / job is running... but is there really not an existing retriever?

    ret_options = {
        'no_create': True
    }

    try:
        ret = make_retriever(user, asset_row, retriever_options=ret_options, db=db)
        if ret:
            return MyResponse(True, {'retriever': ret.info()}).to_json()
    except:
        # In any case, we couldn't make it.
        pass

    # We really can't find any.
    return MyResponse(True).to_json()


@bp.route('/jobs', methods=('GET',))
@token_optional
@cross_origin()
def jobs(user: User):

    asset_id = request.args.get('id')
    kind = request.args.get('kind', '%')
    limit = request.args.get('limit', 100)
    offset = request.args.get('offset', 0)
    job_id = request.args.get('job_id', None)

    asset = get_asset(user, asset_id)
    if not asset:
        return MyResponse(False, reason="Your asset was not found").to_json()

    jobs = search_for_jobs(kind=kind, asset_id=asset_id, order_by=[['time_uploaded', False]], job_id=job_id, limit=limit, offset=offset)

    return MyResponse(True, {'results': jobs}).to_json()


# Returns top level asset rows now, not resources
@bp.route('/sources-info', methods=('GET',))
@token_optional
@cross_origin()
def sources_info(user: User):

    asset_id = request.args.get('id')
    if not asset_id:
        return MyResponse(False, reason="No id provided").to_json()

    asset = get_asset(user, asset_id)
    if not asset:
        return MyResponse(False, reason="Asset not found").to_json()

    order_by_clause = ""
    ordered = request.args.get('ordered')
    if ordered:
        order = get_book_order(asset_id)
        if order is not None and len(order['ids']):
            str_order = ', '.join([str(x) for x in order['ids'][::-1]])
            order_by_clause = f"ORDER BY FIELD(a.id, {str_order}) DESC"

    sql = f"""
        WITH a as (
            SELECT DISTINCT *
            FROM assets
            WHERE id IN (
                SELECT `value`
                FROM asset_metadata
                WHERE `key`='{RETRIEVAL_SOURCE}'
                  AND `asset_id`=%s
            )
        )
        SELECT a.* FROM a
        LEFT JOIN asset_permissions ap ON a.group_id=ap.group_id OR a.id=ap.asset_id
        WHERE {get_permissioning_string(user)}
        GROUP BY a.id
        {order_by_clause}
        LIMIT 1000
    """
    db = get_db()
    curr = db.cursor()
    curr.execute(sql, (asset['id'],))

    results = curr.fetchall()

    return MyResponse(True, {'results': results}).to_json()


@bp.route('/source-of', methods=('GET',))
@cross_origin()
@token_optional
def source_of(user: User):
    asset_id = request.args.get('id')
    limit = request.args.get('limit')
    if not limit or int(limit) > 1000:
        limit = "5"

    if not asset_id:
        return MyResponse(False, reason="No id provided").to_json()

    asset = get_asset(user, asset_id)
    if not asset:
        return MyResponse(False, reason="Asset not found").to_json()
    
    db = get_db()

    sql = f"""
        WITH a as (
            SELECT *
            FROM assets
            WHERE id IN (
                SELECT `asset_id`
                FROM asset_metadata
                WHERE `key`='{RETRIEVAL_SOURCE}'
                  AND `value`=%s
            )
        )
        SELECT a.* FROM a
        LEFT JOIN asset_permissions ap ON a.id = ap.asset_id OR a.group_id = ap.group_id
        WHERE {get_permissioning_string(user)}
        GROUP BY a.id
        LIMIT {db.escape_string(limit)}
    """

    curr = db.cursor()
    curr.execute(sql, (asset['id'],))

    results = curr.fetchall()

    return MyResponse(True, {'results': results}).to_json()


@bp.route('/x-ray', methods=('GET',))
@cross_origin()
@token_optional
def x_ray(user: User):
    asset_id = request.args.get('id')
    asset = get_asset(user, asset_id)
    if not asset:
        return MyResponse(False, reason="Asset not found").to_json()

    ret = make_retriever(user, asset)
    if ret:
        ret: Retriever

        with tempfile.NamedTemporaryFile(mode='w+', delete=False, suffix='.txt') as tempf:
            for chunk in ret.get_chunks():
                chunk: Chunk
                tempf.write(chunk.txt)
                tempf.write('\n')  # Optional: Separate chunks with newlines
            # Make sure to flush so all data is written to the disk
            tempf.flush()

        resp = send_file(tempf.name, as_attachment=True, download_name=f'{asset["title"]}.txt', mimetype='text/plain')
        resp.headers.add("Access-Control-Expose-Headers", "Content-Disposition")

        @resp.call_on_close
        def cleanup(response):
            os.remove(tempf.name)
            return response

        # Send the file to the user
        return resp
    
    # Ret is none, couldn't make ret
    return MyResponse(False, status=500).to_json()


# Returns empty object if chunk isn't found (out of bounds, probably.)
@bp.route('/get-chunk', methods=('GET',))
@cross_origin()
@token_optional
def get_chunk_(user: User):
    asset_id = request.args.get('id')
    asset = get_asset(user, asset_id)
    if not asset:
        return MyResponse(False, reason="Asset not found").to_json()

    chunk_index = request.args.get('chunk_index')

    ret_options = {
        'no_create': True
    }

    ret = make_retriever(user, asset, retriever_options=ret_options)
    
    desired_chunk: Chunk = None
    
    if ret:
        ret: Retriever

        for chunk in ret.get_chunks():
            chunk: Chunk
            if chunk.index == int(chunk_index):
                desired_chunk = chunk
                break
    else:
        # Probably NoCreateError
        return MyResponse(False, reason="Probably haven't processed the text yet").to_json()

    if desired_chunk is None:
        return MyResponse(True, {}).to_json()

    return MyResponse(True, {'chunk': desired_chunk.to_json()}).to_json()


@bp.route('/add-resource', methods=('POST',))
@cross_origin()
@token_required
def add_resource_(user: User):

    id = request.json.get('id')
    resource_id = request.json.get('resource_id')

    existing_asset = get_asset(user, id, needs_edit_permission=True)
    new_asset = get_asset(user, resource_id)

    if not existing_asset or not new_asset:
        return MyResponse(False, reason="Couldn't find one resource or another").to_json()

    # Why not an error? For now, it's OK if a user accidentally does this - but it has no effect.
    if existing_asset['id'] == new_asset['id']:
        return MyResponse(True).to_json()

    set_sources(user, id, [resource_id], additive=True)

    return MyResponse(True).to_json()


# Similar to above, but more suitable to a group of assets rather than folder additions
# It's NOT ADDITIVE. (really ought to be set-resources)
# ex. quiz sources
@bp.route('/add-resources', methods=('POST',))
@cross_origin()
@token_required
def add_resources_(user: User):

    id = request.json.get('id')
    resource_ids = request.json.get('resource_ids')
    save_order = request.json.get('save_order')

    existing_asset = get_asset(user, id, needs_edit_permission=True)

    if not existing_asset:
        return MyResponse(False, reason="Couldn't find the existing asset").to_json()
    
    new_asset_ids = []
    for rid in resource_ids:
        new_asset = get_asset(user, rid)
        if new_asset:
            new_asset_ids.append(new_asset['id'])

    set_sources(user, id, new_asset_ids)
    
    if save_order:
        set_book_order(id, resource_ids)

    return MyResponse(True).to_json()


# Suggest questions for e.g. chat
@bp.route('/questions', methods=('POST',))
@cross_origin()
@token_required
def suggest_questions_(user: User):
    id = request.json.get('id')
    asset_row = get_asset(user, id)
    if not asset_row:
        return MyResponse(False, reason="Couldn't find asset to ask questions").to_json()
    
    detached = request.json.get('detached')
    context = request.json.get('context')
    n = request.json.get('n')
    if not n:
        n = 3

    questions = suggest_questions(user, asset_row, context, detached=detached, n=n)
    return MyResponse(True, {'questions': questions}).to_json()


# Revise content for audio / simplicity
@bp.route('/revise', methods=('POST',))
@cross_origin()
@token_required
def revise(user: User):
    id = request.json.get('id')
    job_name = request.json.get('job_name')

    # Need it but also does permissioning
    asset_row = get_asset(user, id)
    if not asset_row:
        return MyResponse(False, reason="Asset not found.").to_json()

    retriever_options = {}
    retriever_type_name = 'retriever'
    applier: Retriever = make_retriever(user, asset_row, retriever_type_name=retriever_type_name, retriever_options=retriever_options)
    if not applier:
        return MyResponse(False, reason="Could not make applier").to_json()

    combine_chunks = 3

    meta = json.dumps({})

    job_id = start_job('Revise', meta, id, 'revise' if not job_name else job_name, user_id=user.user_id)        

    metadata = {'job_id': job_id}
    make_log(user, id, request.remote_addr, APPLY_ACTIVITY, json.dumps(metadata))

    instructions = """You are but one worker in a pipeline to revise a scanned document for audio. Your task is to edit the text so that it can be more easily read aloud, like as a lecture. You should remove artifacts of the scanning process, such as tables, image captions, citations, or repetitive copyright notices (they are supplied elsewhere at the beginning). Explicitly write (in words) out any important symbols, like math operations or LaTex. Bullets can be replaced by commas. Remove erroneous new line characters. Do not include data that looks like it's from a list, table, or graph; briefly describe the data instead in natural language.
 If excerpts consist exclusively of references or footnotes, respond simply "Citations" - it means you received a bad chunk of the text. Similarly, include only narrative content - if bullet point citations are given exclusively, you received a bad chunk of text, and should respond simply once with "See the text for more references", just once. There is no need to provide introductory or conclusory sentences; recall that you are perhaps writing in the middle of some section. For narrative sections, try to be faithful to the document's original wording, but re-write as necessary."""

    task_apply.apply_async(args=[pickle.dumps(applier), instructions], kwargs={'job_id': job_id, 'combine_chunks': combine_chunks, 'new_conn':True})

    make_log(user, id, None, REVISE_ACTIVITY)

    return MyResponse(True, {'job_id': job_id}).to_json()


@bp.route('/get-revised', methods=('POST',))
@cross_origin()
@token_required
def get_revised(user: User):
    id = request.json.get('id')
    job_id = request.json.get('job_id')
    asset_row = get_asset(user, id)
    if not asset_row:
        return MyResponse(False, reason="Asset not found.").to_json()

    reducer: Reducer = Reducer(id, job_id)
    return reducer.append('txt', line_break=1)


# Give default 5 recommendations from collections (all recs come from some random group, based on non-embedding search)
@bp.route('/recommend', methods=('POST',))
@cross_origin()
@token_required
def get_recommendations(user: User):
    source_text = request.json.get('txt')
    n = request.json.get('n')
    if not n:
        n = 5

    # Use model to select a group
    # Works for up to 30 groups currently ... after that it could miss some groups.
    groups, _ = search_groups(user, "", 0, 30, get_total=False, include_for_sale=True)
    sys = get_chosen_group_system_prompt(groups)
    user_prompt = get_chosen_group_prompt(source_text)
    lm: LM = LM_PROVIDERS[BALANCED_CHAT_MODEL]
    response = lm.run(user_prompt, system_prompt=sys, make_json=True)

    chosen_group_id = None
    try:
        obj = json.loads(response)
        chosen_group_id = obj['group_id']
    except:
        print(f"Error processing LM response in recommendation. Here was the response: {response}", file=sys.stderr)
    
    if chosen_group_id is None:
        return MyResponse(False, reason="Could not process initial LM response").to_json()

    group = get_group(user, chosen_group_id)
    if not group:  # User doesn't have access to this group? shouldn't happen though.
        return MyResponse(True, {'results': []}).to_json()  # the fact that there's no 'group' is tied to the frontend

    retriever: InterAssetRetriever = InterAssetRetriever(chosen_group_id)

    found_assets = retriever.query(source_text, nresults=n)  # query returns an incomplete asset row
    top_assets = get_assets(user, [x['id'] for x in found_assets])

    return MyResponse(True, {'results': top_assets, 'group': group}).to_json()


# Since summaries have transitioned to quick summaries, this is a legacy function for finding old summaries. (9/17/24 - you can probably delete in a few months.)
# Not actually used in /summary since it lacks a few details only relevant for creating/polling old summaries
def find_previous_legacy_summary(asset_id):
    jobs = search_for_jobs(kind=SUMMARY_PAIRWISE_JOB, asset_id=asset_id, order_by=[['time_uploaded', False]], limit=100, offset=0)
    if len(jobs):  # Found a summary pairwise job
        job = jobs[0]
        if job['error']:  # did job encounter an error?
            return None
        if job['resource_id']:  # is job complete?
            resource_id = job['resource_id']
            res = get_job_resource(asset_id, resource_id)
            if not res:
                return None
            tmp = tempfile.NamedTemporaryFile(delete=False)
            try:
                download_file(tmp.name, res)
                with open(tmp.name, 'r') as fhand:
                    summary_text = fhand.read()
                    return summary_text
            finally:
                tmp.close()


"""
**DEPRECATED IN FAVOR OF QUICK SUMMARY**

Args: id = asset id, make = bool - should I make summary if not found?

Returns:
    {'error': ''} if there's been an error
    {'summary_text': ''} if the summary text is available
    {'step': 'apply', 'progress': float} if in apply step
    {'step': 'reduce', 'progress': float} if in reduce step

Don't need edit permission to make a summary
"""
@bp.route('/summary', methods=('POST',))
@cross_origin()
@token_required
def get_or_make_summary(user: User):

    asset_id = request.json.get('id')
    make = request.json.get('make')  # if the summary job isn't found, start one
    force_make = request.json.get('force_make')

    job_id = request.json.get('job_id')

    asset = get_asset(user, asset_id)
    if not asset:
        return MyResponse(False, reason="Asset not found", status=404).to_json()

    APPLY_STEP = "apply"
    REDUCE_STEP = "reduce"

    # Check for previous summary pairwise job (the last step)
    jobs = search_for_jobs(kind=SUMMARY_PAIRWISE_JOB, asset_id=asset_id, order_by=[['time_uploaded', False]], job_id=job_id, limit=100, offset=0)
    if len(jobs):  # Found a summary pairwise job
        job = jobs[0]

        if force_make:
            delete_job(asset_id, job['id'])
        else:
            if job['error']:  # did job encounter an error?
                error_text = "Error"
                try:
                    error_text = json.loads(job['error'])['text']
                except:
                    pass
                return MyResponse(False, {'error': error_text}).to_json()
            if job['resource_id']:  # is job complete?
                resource_id = job['resource_id']
                res = get_job_resource(asset_id, resource_id)
                if not res:
                    return MyResponse(False, {'error': f'Summary resource with {resource_id} not found'}).to_json()
                tmp = tempfile.NamedTemporaryFile(delete=False)
                try:
                    download_file(tmp.name, res)
                    with open(tmp.name, 'r') as fhand:
                        summary_text = fhand.read()
                        return MyResponse(True, {'summary_text': summary_text}).to_json()
                finally:
                    tmp.close()
            # Job is still going on then
            prog = job['progress']
            return MyResponse(True, {'step': REDUCE_STEP, 'progress': prog, 'job_id': job['id']}).to_json()
        
    # If we've made it here, then there's no reduce job, or it's a force make.
    # Is there an apply job?

    jobs = search_for_jobs(kind=SUMMARY_APPLY_JOB, asset_id=asset_id, order_by=[['time_uploaded', False]], job_id=job_id, limit=100, offset=0)
    if len(jobs) > 0:  # There's an existing apply job
        job = jobs[0]
        if force_make:
            delete_job(asset_id, job['id'])
        elif job['is_complete']:
            # Start reduce job
            new_job_id = start_summary_reduce_job(user, asset, job['id'])
            return MyResponse(True, {'step': REDUCE_STEP, 'progress': 0, 'job_id': new_job_id}).to_json()
        else:
            return MyResponse(True, {'step': APPLY_STEP, 'progress': job['progress'], 'job_id': job['id']}).to_json()
    # There's no summary
    if not make and not force_make:
        return MyResponse(True, {}).to_json()
    
    # Make one I guess.
    new_job_id = start_summary_apply_job(user, asset)
    make_log(user, asset['id'], None, SUMMARY_ACTIVITY)

    return MyResponse(True, {'step': APPLY_STEP, 'progress': 0, 'job_id': new_job_id}).to_json()


@bp.route('/quick-summary', methods=('POST',))
@token_optional
@cross_origin()
def quick_summary(user: User):
    asset_id = request.json.get('id')
    no_create = request.json.get('no_create')
    redo = request.json.get('redo')

    if not user and not no_create:
        return MyResponse(False, reason="When not signed in, must call quick-summary with no_create=True").to_json()

    asset = get_asset(user, asset_id)
    if not asset:
        return MyResponse(False, reason="Couldn't find asset", status=404).to_json()
    
    tmp: Template = get_template_by_code(asset['template'])
    if not tmp.summarizable:
        return MyResponse(False, reason=f"Template {asset['template']} not summarizable.")

    # Check for existing summary
    if not redo:
        summary_res = get_asset_resource(asset_id, SUMMARY_FILE)
        if summary_res:
            temp_file = tempfile.NamedTemporaryFile(mode='w+', delete=False)
            download_file(temp_file.name, summary_res)
            summary_text = temp_file.read()
            temp_file.close()
            os.remove(temp_file.name)
            # Return just the text so it's like it was streaming.
            return summary_text
        # Check for legacy
        leg_summary_text = find_previous_legacy_summary(asset_id)
        if leg_summary_text:
            return leg_summary_text
    if no_create:
        return ""
    # Otherwise, we start making the summary.

    retriever: Retriever = make_retriever(user, asset)
    if not retriever:
        return MyResponse(False, reason="Couldn't make retriever").to_json()
    lm: LM = LM_PROVIDERS[FAST_LONG_CONTEXT_MODEL]
    chunks = retriever.max_chunks(lm, safe_context_length=get_safe_retrieval_context_length(lm), use_ends=True)  # suitable chunks for long context
    
    tmp: Template = get_template_by_code(asset['template'])
    user_prompt = get_quick_summary_prompt()
    system_prompt = tmp.build_quick_summary_system_prompt(chunks)
    
    def gen_text():
        total_summary = ""
        for x in lm.stream(user_prompt, system_prompt=system_prompt):
            total_summary += x
            yield x
        # Once done, store the summary.
        add_resource_from_text(asset_id, SUMMARY_FILE, total_summary, replace=redo)
    
    make_log(user, asset['id'], None, QUICK_SUMMARY_ACTIVITY)

    return gen_text()


@bp.route('/key-points', methods=('POST',))
@token_optional
@cross_origin()
def key_points(user: User):
    asset_id = request.json.get('id')
    no_create = request.json.get('no_create')
    redo = request.json.get('redo')

    if not user and not no_create:
        return MyResponse(False, reason="When not signed in, must call key-points with no_create=True").to_json()

    asset_row = get_asset(user, asset_id)
    if not asset_row:
        return MyResponse(False, reason="No asset found", status=404).to_json()
    
    tmp: Template = get_template_by_code(asset_row['template'])
    if not tmp.summarizable:
        return MyResponse(False, reason=f"Key points for template {asset_row['template']} not available.")
    
    # Check for existing key points
    if not redo:
        summary_res = get_asset_resource(asset_id, KEY_POINTS_FILE)
        if summary_res:
            temp_file = tempfile.NamedTemporaryFile(mode='w+', delete=False)
            download_file(temp_file.name, summary_res)
            kp_json = temp_file.read()
            temp_file.close()
            os.remove(temp_file.name)
            kp_obj = json.loads(kp_json)
            return MyResponse(True, {'bullets': kp_obj['bullets']}).to_json()
    if no_create:
        return MyResponse(True).to_json()
    # Otherwise, we start making the key points.

    retriever: Retriever = make_retriever(user, asset_row)
    if not retriever:
        return MyResponse(False, reason="Couldn't make retriever").to_json()

    lm: LM = LM_PROVIDERS[FAST_LONG_CONTEXT_MODEL]
    chunks = retriever.max_chunks(lm, safe_context_length=get_safe_retrieval_context_length(lm), use_ends=True)  # suitable chunks for long context

    tmp: Template = get_template_by_code(asset_row['template'])
    system_prompt = tmp.build_key_points_system_prompt(chunks)
    
    user_prompt = get_key_points_user_prompt()

    llm_text = lm.run(user_prompt, system_prompt=system_prompt, make_json=True)

    llm_json = None
    bullet_json = None
    try:
        llm_json = json.loads(llm_text)
        bullet_json = llm_json['bullets']
    except ValueError:
        return MyResponse(False, reason="LLM returned non-JSON").to_json()
    
    add_resource_from_text(asset_id, KEY_POINTS_FILE, json.dumps(llm_json), replace=redo)
    
    make_log(user, asset_id, None, KEY_POINTS_ACTIVITY)

    return MyResponse(True, {'bullets': bullet_json}).to_json()
