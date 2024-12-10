from .template import Template
from flask import (
    Blueprint,
    request
)
from ..auth import token_required, token_optional, User
from ..asset_actions import get_asset, search_assets, get_asset_metadata, set_sources, get_sources, upload_asset
from flask_cors import cross_origin
from ..template_response import MyResponse
from ..db import get_db
from ..integrations.lm import LM, LM_PROVIDERS, FAST_CHAT_MODEL, BALANCED_CHAT_MODEL, HIGH_PERFORMANCE_CHAT_MODEL
from ..prompts.curriculum_prompts import (
    get_brainstorm_system_prompt,
    get_to_structured_system_prompt,
    get_link_system_prompt,
    get_link_prompt,
    get_desc_system_prompt,
    get_fake_brainstorm_prompt,
    get_fake_brainstorm_system_prompt
)
import json
import sys
from ..utils import get_unique_id
from ..activity import get_aggregated_activity, make_log
from ..configs.str_constants import CURR_START_ACTIVITY, CURR_COMPLETE_ACTIVITY, DIVIDER_TEXT
from .template import EmailRules
from ..db import needs_db, ProxyDB
from ..auth import get_users
from ..configs.secrets import FRONTEND_URL
from ..configs.user_config import APP_NAME
import random


bp = Blueprint('curriculum', __name__, url_prefix="/curriculum")


@bp.route('/get', methods=('GET',))
@cross_origin()
@token_optional
def get_curriculum(user: User):
    id = request.args.get('id')

    asset_row = get_asset(user, id)
    if not asset_row:
        return MyResponse(False, reason="Couldn't find asset").to_json()
    
    db = get_db()

    metas, _ = get_asset_metadata(user, id, ['curriculum_state'], db=db)

    if len(metas) == 0:
        return MyResponse(True, {'curriculum_state': []}).to_json()
    
    full_state = json.loads(metas[0]['value'])
    
    sources = get_sources(user, id, db=db)

    if user:
        aggregated_activity = get_aggregated_activity(user, None, [user.user_id], [x['id'] for x in sources], db=db)
    else:
        aggregated_activity = []

    return MyResponse(True, {
        'curriculum_state': full_state,
        'assets_info': sources,
        'aggregated_activity': aggregated_activity
    }).to_json()


@bp.route('/save', methods=('POST',))
@cross_origin()
@token_required
def save_curriculum(user: User):
    id = request.json.get('id')
    new_full_state = request.json.get('value')
    old_full_state = request.json.get('old_value')  # unused for now, will be used though

    asset_row = get_asset(user, id, needs_edit_permission=True)
    if not asset_row:
        return MyResponse(False, reason="Could not find asset").to_json()

    # Add relevant course material as asset resources

    # Traverse value to find existing asset resources (links and quizzes)
    sources = []
    for key in new_full_state['nodes']:
        x = new_full_state['nodes'][key]
        if 'links' in x and x['links'] and len(x['links']) > 0:
            sources.extend([y['id'] for y in x['links']])
        if 'quiz' in x and x['quiz']:
            sources.append(x['quiz'])

    db = get_db()

    # Set sources will only do the necessary adds / permissioning stuff
    set_sources(user, id, sources, db=db, no_commit=True)
    curr = db.cursor()

    # Now actually update / insert the asset metadata
    sql = """
    DELETE FROM asset_metadata WHERE `asset_id`=%s AND `key`=%s
    """
    curr.execute(sql, (id, 'curriculum_state'))
    sql = """
    INSERT INTO asset_metadata (`asset_id`, `key`, `value`, `user_id`)
    VALUES (%s, %s, %s, %s)
    """
    curr.execute(sql, (id, 'curriculum_state', json.dumps(new_full_state), user.user_id))

    db.commit()

    return MyResponse(True, {'result': new_full_state}).to_json()


# Note that we save the metadata this way, but get it via /metadata
@bp.route('/save-user', methods=('POST',))
@cross_origin()
@token_required
def save_user(user: User):
    # We don't really need to check for permissions here, funny enough, be we need the asset anyway.
    id = request.json.get('id')
    asset_row = get_asset(user, id)
    if not asset_row:
        return MyResponse(False, reason="Couldn't find asset", status=404).to_json()
    
    user_state = request.json.get('user_state')
    prev_user_state = request.json.get('prev_user_state')  # for now, just used for tracking activity. In future, should also track consistency?

    db = get_db()
    curr = db.cursor()

    # Now for tracking
    # It's important that the time_uploaded gets reset on every save so that needs_attention doesn't expire.
    sql = """
    DELETE FROM asset_metadata WHERE `asset_id`=%s AND (`key`=%s or `key`=%s) AND `user_id`=%s
    """
    curr.execute(sql, (id, 'curr_stage', 'user_state', user.user_id))
    
    # sql is borrowed for multiple queries FYI
    sql = """
    INSERT INTO asset_metadata (`asset_id`, `key`, `value`, `needs_attention`, `user_id`)
    VALUES (%s, %s, %s, %s, %s)
    """
    curr.execute(sql, (id, 'user_state', json.dumps(user_state), None, user.user_id))

    if 'stage' in user_state:
        curr_stage = {
            'stage': user_state['stage']  # in the future, more stuff could be added
        }
        if user_state['stage'] == 1:  # currently being taken
            curr.execute(sql, (id, 'curr_stage', json.dumps(curr_stage), 1, user.user_id))
            if 'stage' not in prev_user_state or prev_user_state['stage'] == 0:
                make_log(user, id, None, CURR_START_ACTIVITY, None, db=db)
        elif user_state['stage'] == 2:
            curr.execute(sql, (id, 'curr_stage', json.dumps(curr_stage), 0, user.user_id))
            if 'stage' not in prev_user_state or prev_user_state['stage'] == 1:
                make_log(user, id, None, CURR_COMPLETE_ACTIVITY, None, db=db)

    db.commit()

    return MyResponse(True, {'result': user_state}).to_json()


@bp.route('/brainstorm', methods=('POST',))
@cross_origin()
@token_required
def brainstorm(user: User):
    id = request.json.get("id")
    asset_row = get_asset(user, id)
    if not asset_row:
        return MyResponse(False, reason="Asset not found.").to_json()
    
    user_text = request.json.get('user')
    context = request.json.get('context')

    length = request.json.get('length')
    background = request.json.get('background')
    level = request.json.get('level')

    system_prompt = get_brainstorm_system_prompt(length, background, level)

    lm: LM = LM_PROVIDERS[HIGH_PERFORMANCE_CHAT_MODEL]
    return lm.stream(user_text, context=context, system_prompt=system_prompt)


@bp.route('/desc', methods=('POST',))
@cross_origin()
@token_required
def desc(user: User):
    id = request.json.get("id")
    asset_row = get_asset(user, id)
    if not asset_row:
        return MyResponse(False, reason="Asset not found.").to_json()
    
    title = request.json.get('title')
    outline = request.json.get('outline')

    system_prompt = get_desc_system_prompt(outline)

    lm: LM = LM_PROVIDERS[BALANCED_CHAT_MODEL]
    return lm.stream(title, system_prompt=system_prompt)


def to_structured(text):
    system_prompt = get_to_structured_system_prompt()
    lm: LM = LM_PROVIDERS[BALANCED_CHAT_MODEL]
    result_str = lm.run(text, system_prompt=system_prompt, make_json=True)
    result = []
    tries = 0
    MAX_TRIES = 2
    while tries < MAX_TRIES:
        try:
            obj = json.loads(result_str)
            result = obj['content']
            
            # Check the schema
            def check_schema(lst):
                if not isinstance(result, list):
                    raise ValueError("Result was not a list")
            
                for obj in lst:
                    if not isinstance(obj, dict):
                        raise ValueError("Some object wasn't a dict")
                    if 'title' not in obj:
                        raise ValueError("Title not in object")
                    if 'subsections' in obj:
                        check_schema(obj['subsections'])
            
            check_schema(result)

            break
        except ValueError:
            tries += 1
            if tries == 1:
                system_prompt += "\nVERY IMPORTANT: INCLUDE ONLY WELL FORMED JSON (NO OTHER TEXT), INCLUDING ANY RELEVANT ESCAPE CHARACTERS."

    if tries >= MAX_TRIES:
        print(f"to-structured max tries exceeded, result str: {result_str}", file=sys.stderr)
        return False, "Could not create well formed JSON."

    # Add IDs:
    def add_ids(res):
        for obj in res:
            obj['id'] = get_unique_id()
            if 'subsections' in obj:
                add_ids(obj['subsections'])
    add_ids(result)

    return True, result


@bp.route('/to-structured', methods=('POST',))
@cross_origin()
@token_required
def to_structured_(user: User):
    id = request.json.get("id")
    asset_row = get_asset(user, id)
    if not asset_row:
        return MyResponse(False, reason="Asset not found.").to_json()
    
    text = request.json.get('text')
    is_ok, result = to_structured(text)

    if not is_ok:
        return MyResponse(False, reason=result).to_json()

    return MyResponse(True, {'result': result}).to_json()


# title = section title, prompt = brainstorm user prompt
# context = list of leaf titles
def link_given_results(results, prompt, title, context=[]):
    system_prompt = get_link_system_prompt(prompt, title, context=context)
    txt = get_link_prompt(results, title)

    tries = 0
    MAX_TRIES = 2

    nums = []

    while tries < MAX_TRIES:
        try:
            lm: LM = LM_PROVIDERS[HIGH_PERFORMANCE_CHAT_MODEL]
            gen = lm.run(txt, system_prompt=system_prompt)
            nums = list(set([int(x.strip()) for x in gen.split("\n")]))  # remove duplicates
            for num in nums:
                if num > len(results):
                    raise ValueError("Sources chosen that aren't in the list")
            break
        except ValueError:
            tries += 1

    if len(nums) == 0:
        return False, "Failed to choose sources"

    chosen = [x for i, x in enumerate(results) if (i+1) in nums]
    return True, chosen


@bp.route('/link', methods=('POST',))
@cross_origin()
@token_required
def link_(user: User):
    id = request.json.get("id")
    asset_row = get_asset(user, id)
    if not asset_row:
        return MyResponse(False, reason="Asset not found.").to_json()
    
    title = request.json.get('title')
    prompt = request.json.get('prompt')
    collections = request.json.get('collections')
    filter_tags_on_groups = request.json.get('filter_tags_on_groups')
    exclude_ids = request.json.get('exclude_ids')
    
    if not collections:
        return MyResponse(False, reason="No collections specified").to_json()
    
    if not title:
        return MyResponse(False, reason="No section title").to_json()

    # Search over collections for assets
    from .templates import TEMPLATES
    templates = map(lambda x: x.code, filter(lambda x: x.code != 'folder', TEMPLATES))  # exclude folders
    results, _ = search_assets(user, search=title, group_ids=collections, only_templates=templates, filter_tags_on_groups=filter_tags_on_groups, limit=20, exclude_ids=exclude_ids, ignore_total=True)

    is_ok, chosen = link_given_results(results, prompt, title)
    if not is_ok:
        return MyResponse(False, reason=chosen).to_json()

    return MyResponse(True, {'results': chosen}).to_json()


@bp.route('/build-from-folder', methods=('POST',))
@cross_origin()
@token_required
def build_from_folder(user: User):
    folder_id = request.json.get('id')
    folder = get_asset(user, folder_id)
    if not folder:
        return MyResponse(False, reason="Folder not found").to_json()
    
    sources = get_sources(user, folder_id, ordered=True)

    if not sources or not len(sources):
        return MyResponse(False, reason="No content found in folder").to_json()
    
    def build():
        db = get_db(new_connection=True)

        # First, simulate a brainstorm.
        # Second, do to-structured
        # Third, do linking
        # Then create the asset and return the asset id.
        data = {'text': 'Brainstorming (1/3)'}
        yield DIVIDER_TEXT + json.dumps(data)

        # 1. Brainstorm:
        # a. ask LLM to ask what it wants to learn based on the sources
        # b. ask LLM to create outline from (a) and the sources

        brainstorm_system = get_fake_brainstorm_system_prompt(sources)
        brainstorm_user = get_fake_brainstorm_prompt(sources)
        lm: LM = LM_PROVIDERS[FAST_CHAT_MODEL]
        first_brainstorm_response = lm.run(brainstorm_user, system_prompt=brainstorm_system)

        brainstorm2_system_prompt = get_brainstorm_system_prompt(None, None, None)
        second_brainstorm_response = lm.run(first_brainstorm_response, system_prompt=brainstorm2_system_prompt)

        yield DIVIDER_TEXT + json.dumps({'text': 'Structuring (2/3)'})

        # 2. To structured:
        # Take output from 2 and run to-structured
        is_ok, structured = to_structured(second_brainstorm_response)
        if not is_ok:
            yield DIVIDER_TEXT + json.dumps({'error': structured})

        yield DIVIDER_TEXT + json.dumps({'text': 'Finding Resources 0% (3/3)'})

        # 3. Do linking:
        total_leaves = {'count': 0}
        leaf_titles = []
        def count_leaves(root, title_path=[]):
            if 'subsections' in root and len(root['subsections']):
                for sub in root['subsections']:
                    count_leaves(sub, title_path=[*title_path, root['title']])
            else:
                total_leaves['count'] += 1
                title = " > ".join(title_path) + (" > " if len(title_path) else "") + root['title']
                leaf_titles.append(title)
        
        for root in structured:
            count_leaves(root)

        linked_sources = []
        count = {'count': 0}
        def link_leaf(root, title_path=[]):
            count['count'] += 1
            used_search = False
            sources_to_link = [x for x in sources if x['id'] not in linked_sources]

            def extend_via_search():
                sec_title = root['title']
                searched, _ = search_assets(user, search=sec_title, group_ids=[folder['group_id']], only_templates=['document'], exclude_ids=linked_sources, limit=20, ignore_total=True)
                sources_to_link.extend(searched)

            if len(sources_to_link) <= 3:
                used_search = True
                extend_via_search()

            sec_title = " > ".join(title_path) + (" > " if len(title_path) else "") + root['title']
            def do_link(am_using_search):
                is_ok, links = link_given_results(sources_to_link, first_brainstorm_response, sec_title, context=leaf_titles)
                if is_ok and len(links):
                    root['links'] = links
                    linked_sources.extend([x['id'] for x in links])
                else:
                    if not am_using_search:
                        extend_via_search()
                        do_link(True)
            do_link(used_search)

        def traverse(root, title_path=[]):
            if 'subsections' in root and len(root['subsections']):
                for sub in root['subsections']:
                    for x in traverse(sub, title_path=[*title_path, root['title']]):
                        yield x
            else:
                per = int(round(count['count'] / total_leaves['count'], 2) * 100)
                yield DIVIDER_TEXT + json.dumps({'text': f'Finding Resources {per}% (3/3)'})
                link_leaf(root, title_path=title_path)

        for root in structured:
            for jawn in traverse(root):
                yield jawn
        
        title = f"Curriculum: {folder['title']}"
        structured_sections = [x['title'] for x in structured]
        desc = f"Curriculum based on {folder['title']}, containing sections titled: {', '.join(structured_sections)}"
        template = "curriculum"
        author = f"{folder['author']} (edited by {APP_NAME})"

        is_ok, new_asset_id = upload_asset(user, None, title, desc, desc, template, author, False, db=db, no_commit=True)
        if not is_ok:
            raise Exception("Couldn't upload asset")  # TODO
        
        # Insert appropriate asset metadata
        # We're piggy-backing off of old infrastructure on the frontend that will convert this server based format to the actual format.
        # Ask Gordon if you need to understand this :\
        sql = """
        INSERT INTO asset_metadata (`asset_id`, `key`, `value`, `user_id`)
        VALUES (%s, %s, %s, %s)
        """
        curr = db.cursor()
        full_brainstorm = {'user': first_brainstorm_response, 'ai': second_brainstorm_response}
        curr.execute(sql, (new_asset_id, 'curriculum_state', json.dumps({
            'value': structured,
            'currStep': 3,  # final view
            'brainstormResponse': full_brainstorm,
            'brainstormChatRounds': [full_brainstorm],
            'selectedGroups': {folder['group_id']: True},
            'selectedGroupTags': {}
        }), user.user_id))

        db.commit()

        # An interesting question here is whether or not the database will be updated by the time the user goes to the asset
        # In the future, it might make sense to include some kind of delay or check.
        data = {'text': 'Complete', 'asset_id': new_asset_id}
        yield DIVIDER_TEXT + json.dumps(data)
    
    return build()

class CurriculumEmailRules(EmailRules):
    def __init__(self) -> None:
        super().__init__()
        self.allowed_endpoints = []
        self.needs_edit_permission_endpoints = []

    @needs_db
    def schedule_emails(self, db: ProxyDB=None):
        curr = db.cursor()

        emails = []
        limit = 100  # only send out 100 emails at a time.
        MIN_EMAIL_WAIT = 60 * 24  # in minutes, time after last emailing to allow another email
        COURSE_EXPIRY = 7  # in days of no asset save activity before we stop sending emails
        # Find people who are completing curriculum and haven't received a notification about it lately
        sql = f"""

        WITH meta AS (
            SELECT am.asset_id, am.user_id, am.key, am.needs_attention
            FROM asset_metadata am
            LEFT JOIN notifications n ON
                am.asset_id=n.asset_id AND
                am.user_id=n.user_id AND
                n.timestamp > (NOW() - INTERVAL {MIN_EMAIL_WAIT} MINUTE)
            WHERE
                am.user_id IS NOT NULL AND
                am.key='curr_stage'AND
                am.needs_attention=1 AND
                n.id IS NULL AND
                am.time_uploaded > (NOW() - INTERVAL {COURSE_EXPIRY} DAY)
            LIMIT {limit}
        )
        SELECT meta.asset_id, meta.user_id, meta.key, meta.needs_attention, a.title
        FROM meta
        LEFT JOIN assets a
        ON meta.asset_id = a.id
        """
        curr.execute(sql)
        results = curr.fetchall()

        USERS_BATCH_SIZE = 50
        user_id_to_email = {}
        cl_offset = 0
        while True:
            user_ids = [x['user_id'] for x in results[cl_offset:cl_offset+USERS_BATCH_SIZE]]
            users = get_users(user_ids=user_ids)
            user_id_to_email = {u.user_id: u.email_address for u in users}
            cl_offset += USERS_BATCH_SIZE
            if len(results) < cl_offset:
                break

        # Now that we have the user emails, we can start writing them
        # One email per result
        for res in results:
            asset_url = FRONTEND_URL + f"/assets/{res['asset_id']}"
            curriculum_title = res['title']
            body_options = [
                f'Your course awaits your daily practice, find it <a href="{asset_url}">here</a>.',
                f'Disciplined, steady practice is the best way to complete your learning goals. Try tackling another section of your course {curriculum_title}, available <a href="{asset_url}">here</a>.'
            ]
            email = {
                'recipients': [user_id_to_email[res['user_id']]],
                'email_body': body_options[random.randrange(0, len(body_options))],  # choose a random template for each email
                'subject': f'Continue {curriculum_title} on Abbey',
                # Some data not for the email itself, but for logging a scheduled email.
                '_info': {
                    'user_id': res['user_id'],
                    'asset_id': res['asset_id']
                }
            }
            emails.append(email)

        return emails


class Curriculum(Template):
    def __init__(self) -> None:
        super().__init__()
        self.code = "curriculum"
        self.chattable = False
        self.summarizable = False
        self.metadata_modify_with_edit_perm = ['curriculum_state']
        self.metadata_user_specific = ['user_state']
        self.email_rules = CurriculumEmailRules()
    

