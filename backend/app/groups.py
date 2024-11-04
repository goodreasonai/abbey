from flask import (
    Blueprint,
    request
)
from flask_cors import cross_origin
from .db import get_db, needs_db, ProxyDB
from .template_response import MyResponse
from .auth import token_optional, User, get_permissioning_string, token_required
from .configs.str_constants import PREVIEW_FILE
from .template_response import response_from_resource
import json
from .asset_actions import get_assets, search_assets
from .activity import get_group_activity, get_group_progress, get_aggregated_activity
from .configs.str_constants import ASSET_STATE
from .templates.section import get_section_state
from .asset_actions import get_sources, get_assets_in_group


bp = Blueprint('groups', __name__, url_prefix="/groups")


MAX_GROUPS_LIMIT = 20


# Returns (results, total); total is zero if get_total is false.
# If ids is set (a list), other args are ignored (including offset + limit, up to 1000)
# If ids is set (and no search text), we get tags; otherwise, no (for performance reasons)
# include_for_sale = allow products provided they are permissioned (i.e. purchased)
# iff_for_sale = include all products (subject to search/offset/limit/ids), and only products
@needs_db
def search_groups(user: User, search, offset, limit, ids=None, get_total=True, iff_for_sale=False, include_for_sale=False, include_hidden=False, db=None):
    curr = db.cursor()

    search = db.escape_string(search) if search else ""

    order_by_clause = "a.score DESC, a.title ASC"

    # If ids is set (a list), other args are ignored (including offset + limit)
    tag_select = ""
    tag_prefix = ""
    tag_joins = ""
    id_list_str = ""
    if ids and len(ids) > 0:
        order_by_clause = "a.title ASC"
        offset = 0
        limit = 1000
        id_list_str = f"({','.join([str(x) for x in ids])})"

        tag_prefix = f"""
        WITH asset_tag_counts AS (
            SELECT a.group_id, at.value, COUNT(*) as count
            FROM assets a
            JOIN asset_tags at ON a.id = at.asset_id
            WHERE a.group_id IN {id_list_str}
            GROUP BY a.group_id, at.value
        ),
        grouped_tags AS (
            SELECT group_id, GROUP_CONCAT(CONCAT(value, ':', count) SEPARATOR ',') AS tags
            FROM asset_tag_counts
            GROUP BY group_id
        )
        """
        tag_select = ", MAX(gt.tags) AS tags"  # the max is just a silly mysql compatibility thing
        tag_joins = "LEFT JOIN grouped_tags gt ON asset_groups.id = gt.group_id"

    if search:
        search_clause = f"""
        SELECT 
            asset_groups.*,
            MATCH(asset_groups.title, asset_groups.preview_desc) AGAINST ('{search}' IN NATURAL LANGUAGE MODE) AS score
        FROM asset_groups
        WHERE MATCH(asset_groups.title, asset_groups.preview_desc) AGAINST ('{search}' IN NATURAL LANGUAGE MODE)
        GROUP BY asset_groups.id
        ORDER BY score DESC
        """
    else:
        search_clause = f"""
        {tag_prefix}
        SELECT asset_groups.*, 1 AS score{tag_select}
        FROM asset_groups
        {tag_joins}
        {f"WHERE asset_groups.id IN {id_list_str}" if id_list_str else ""}
        GROUP BY asset_groups.id
        """

    # Different permissioning string based on whether we're getting products for sale (i.e., the user doesn't have access to them)
    permissioning_clause = f"""
        LEFT JOIN asset_permissions ap ON a.id = ap.group_id
        WHERE ({get_permissioning_string(user)})
    """
    if iff_for_sale and include_for_sale:
        permissioning_clause += " AND a.product_id IS NOT NULL"
    elif iff_for_sale:
        permissioning_clause = "WHERE `product_id` IS NOT NULL"
    elif not include_for_sale:
        permissioning_clause += " AND a.product_id IS NULL"

    if not include_hidden:
        permissioning_clause += " AND (a.hidden IS NULL OR a.hidden != 1)"

    sql = f"""
        WITH a as (
            {search_clause}
        )
        SELECT SQL_CALC_FOUND_ROWS DISTINCT a.*
        FROM a
        {permissioning_clause}
        ORDER BY {order_by_clause}
        LIMIT {limit}
        OFFSET {offset}
        """

    curr.execute(sql)
    results = curr.fetchall()

    total = 0
    if get_total:
        curr.execute("SELECT FOUND_ROWS()")
        total = curr.fetchone()['FOUND_ROWS()']

    return results, total


# Adds a "needs_purchase" column to the group stating whether the user doesn't have access and thus needs to purchase (can only be 1 if include_products=True)
@needs_db
def get_group(user, group_id, include_products=False, needs_edit_permission=False, db=None):

    perm_string = get_permissioning_string(user, db=db)
    if include_products:
        perm_string += " OR a.product_id IS NOT NULL"

    sql = f"""
    WITH a as (
        SELECT * FROM asset_groups
        WHERE id = %s
    )
    SELECT DISTINCT
        MIN(CASE WHEN ({get_permissioning_string(user, db=db)}) THEN 0 ELSE 1 END) AS needs_purchase,
        MAX(CASE WHEN ({get_permissioning_string(user, edit_permission=True, db=db)}) THEN 1 ELSE 0 END) AS can_edit,
        a.*
    FROM a
    LEFT JOIN asset_permissions ap ON a.id = ap.group_id
    WHERE {perm_string}
    """
    curr = db.cursor()
    curr.execute(sql, (group_id,))
    res = curr.fetchone()

    if needs_edit_permission and res and not res['can_edit']:
        return None
    return res


# Not permissioned
@needs_db
def set_group_metadata(group_id, metadata_json_obj, db=None):
    txt = json.dumps(metadata_json_obj)
    sql = """
    UPDATE asset_groups SET `metadata` = %s WHERE `id`=%s
    """
    curr = db.cursor()
    curr.execute(sql, (txt, group_id))


# USERS SHOULD NEVER HAVE POWER TO CALL THIS FUNCTION AT WILL
@needs_db
def add_group_permission_by_product_id(user: User, product_id, db: ProxyDB=None):
    assert(user.email)

    sql = """
    INSERT INTO asset_permissions (`email_domain`, `group_id`)
    SELECT %s, `id`
    FROM asset_groups
    WHERE `product_id` = %s;
    """
    curr = db.cursor()
    curr.execute(sql, (user.email, product_id))



@bp.route("/manifest", methods=['GET'])
@token_optional
@cross_origin()
def manifest(user: User):

    limit = request.args.get('limit')
    if not limit:
        limit = 10
    else:
        limit = int(limit)
    if limit > MAX_GROUPS_LIMIT:
        limit = MAX_GROUPS_LIMIT
        
    offset = request.args.get('offset')
    offset = int(offset)
    search = request.args.get('search')

    get_total = request.args.get('get_total')
    if get_total == '0' or not get_total:
        get_total = False
    else:
        get_total = True

    results, total = search_groups(user, search, offset, limit, get_total=get_total, exclusive_conn=get_total)
    resp = {'results': results}
    if get_total:
        resp['total'] = total

    prepend_products_limit = request.args.get('prepend_products_limit', 0, type=int)
    if prepend_products_limit:
        inclusive, _ = search_groups(user, search, 0, prepend_products_limit, get_total=False, iff_for_sale=True)
        if inclusive and len(inclusive):
            exclusive, _ = search_groups(user, search, 0, prepend_products_limit, ids=[x['id'] for x in inclusive], get_total=False, include_for_sale=True)
            for_sale = [x for x in inclusive if x['id'] not in [y['id'] for y in exclusive]]  # could make this better with sets?
            for i in range(len(for_sale)):
                for_sale[i]['needs_purchase'] = True
            resp['results'] = [*exclusive, *for_sale, *results]

    return MyResponse(True, resp).to_json()


@bp.route("/purchases", methods=["GET"])
@cross_origin()
@token_required
def get_purchases_(user: User):
    limit = request.args.get('limit', 3)
    purchased_groups, _ = search_groups(user, "", 0, limit, get_total=False, iff_for_sale=True, include_for_sale=True)
    return MyResponse(True, {'results': purchased_groups}).to_json()


@bp.route("/promoted", methods=["GET"])
@cross_origin()
@token_optional
def get_promoted_(user: User):
    sql = """
    SELECT * FROM asset_groups
    WHERE `promoted`=1
    """
    db = get_db()
    curr = db.cursor()
    curr.execute(sql)
    res = curr.fetchall()
    return MyResponse(True, {'results': res}).to_json()


@bp.route("/manifest-row", methods=['GET'])
@token_optional
@cross_origin()
def manifest_row(user: User):

    db = get_db()

    group_id = request.args.get('id')
    group = get_group(user, group_id, include_products=True, db=db)

    # If it requires purchase, check for any unresolved checkout sessions
    if group and group['needs_purchase'] and user:
        from .pay import resolve_active_checkout_sessions  # have to avoid circular import
        resolved = resolve_active_checkout_sessions(user, db=db)
        if len(resolved):
            group = get_group(user, group_id, include_products=True, db=db)

    if not group:
        return MyResponse(False, reason="Group not found", status=404).to_json()

    return MyResponse(True, {'result': group}).to_json()


# Like /manifest, but uses specified IDs (still uses seach_groups)
@bp.route("/manifest-rows", methods=['POST'])
@token_optional
@cross_origin()
def manifest_rows(user: User):

    group_ids = request.json.get('ids')
    groups, _ = search_groups(user, "", 0, 10_000, ids=group_ids)

    if not groups:
        groups = []

    return MyResponse(True, {'results': groups}).to_json()


# Not permissioned!
@bp.route("/preview-file", methods=['GET'])
@token_optional
@cross_origin()
def preview_file(user: User):

    group_id = request.args.get('id')

    if not group_id:
        return MyResponse(False, reason="No group id specified").to_json()

    sql = """
    SELECT * FROM asset_group_resources WHERE `name`=%s AND `group_id`=%s
    """
    db = get_db()
    curr = db.cursor()
    curr.execute(sql, (PREVIEW_FILE, group_id))
    res = curr.fetchone()

    if not res:
        return MyResponse(False, reason=f"No preview file found for group with id {group_id}").to_json()
    
    # May need to change mimetype in future
    return response_from_resource(res, 'application/json')


# This really ought to be a template specific thing that uses a class/object (following the pattern of assets and their templates)
# But we have this instead to reduce complication with all that while we don't need it.
# This function calls the associated "refresh" for the appropriate template
# Needed because <Section /> needs to refresh when it removes assets that might be associated with the group, and may have other linked assets
@bp.route("/refresh", methods=['POST'])
@cross_origin()
@token_required
def refresh_group(user: User):
    group_id = request.json.get('id')
    group = get_group(user, group_id, needs_edit_permission=True)
    if not group:
        return MyResponse(False, reason="Couldn't find group", status=404).to_json()
    if group['template'] == 'test-study-1':
        test_study_1_refresh(user, group)
    else:
        return MyResponse(False, reason=f"Group template {group['template']} has no refresh function.").to_json()
    return MyResponse(True).to_json()

# TEMPLATE SPECIFIC


# Test study 1

@needs_db
def test_study_1_get_section_quizzes(section_asset_ids, db=None):
    sql = f"""
    SELECT * FROM asset_metadata
    WHERE `asset_id` IN ({','.join([str(x) for x in section_asset_ids])})
    AND `key`='{ASSET_STATE}'
    """

    db = get_db()
    curr = db.cursor()
    curr.execute(sql)
    metas = curr.fetchall()

    section_quiz_ids = {}
    for meta in metas:
        try:
            parsed = json.loads(meta['value'])
            section_quiz_ids[meta['asset_id']] = parsed['sectionQuiz']
        except KeyError:  # probably doesn't have sectionQuiz
            pass

    return section_quiz_ids


@bp.route("/test-study-1/get-section-quizzes", methods=['GET'])
@cross_origin()
@token_required
def test_study_1_get_section_quizzes_(user: User):
    group_id = request.args.get('id')
    if not group_id:
        return MyResponse(False, reason="No group id specified").to_json()
    
    group = get_group(user, group_id)
    if not group:
        return MyResponse(False, reason="No group found").to_json()

    metadata = json.loads(group['metadata'])
    section_asset_ids = metadata['sections']

    if not len(section_asset_ids):
        return MyResponse(True, {'section_quizzes': [], 'section_quiz_activity': []}).to_json()

    section_quiz_ids = test_study_1_get_section_quizzes(section_asset_ids)

    activity = get_aggregated_activity(user, None, [user.user_id], [x for x in section_quiz_ids])
    
    return MyResponse(True, {'section_quizzes': section_quiz_ids, 'section_quiz_activity': activity}).to_json()


@bp.route("/test-study-1/get", methods=['GET'])
@token_optional
@cross_origin()
def test_study_1_get(user: User):

    group_id = request.args.get('id')
    if not group_id:
        return MyResponse(False, reason="No group id specified").to_json()
    
    group = get_group(user, group_id)
    if not group:
        return MyResponse(False, reason="No group found").to_json()

    metadata = json.loads(group['metadata'])
    section_asset_ids = metadata['sections']
    inf_quiz = metadata['inf_quiz'] if 'inf_quiz' in metadata else None
    section_assets = get_assets(user, section_asset_ids)

    activity = []
    activity_assets = {}
    progress = {}
    if user and user.user_id:
        # Get recent activity and relevant assets
        activity = get_group_activity(user, group_id, limit=10, types=['view', 'quiz_grade'])
        for act in activity:
            activity_assets[act['asset_id']] = {}
        asset_rows = get_assets(user, [x for x in activity_assets])
        for ar in asset_rows:
            activity_assets[ar['id']] = ar

        # Get total group progress
        progress = get_group_progress(user, group_id)  # returns a dictionary with info (see func for more)
        
    # May need to change mimetype in future
    return MyResponse(True, {'sections': section_assets, 'inf_quiz': inf_quiz, 'activity': activity, 'activity_assets': activity_assets, 'progress': progress}).to_json()


@bp.route("/test-study-1/edit-header-image", methods=['POST'])
@cross_origin()
@token_required
def test_study_1_edit_header_image(user: User):
    group_id = request.json.get('id')
    group = get_group(user, group_id, needs_edit_permission=True)
    if not group:
        return MyResponse(False, reason="Couldn't find group", status=404).to_json()
    
    image = request.json.get('image')
    meta = json.loads(group['metadata'])
    meta['header_image'] = image

    set_group_metadata(group_id, meta)

    return MyResponse(True).to_json()


@bp.route("/test-study-1/save-sections", methods=['POST'])
@cross_origin()
@token_required
def test_study_1_save_sections(user: User):
    group_id = request.json.get('id')
    group = get_group(user, group_id, needs_edit_permission=True)
    if not group:
        return MyResponse(False, reason="Couldn't find group", status=404).to_json()
    
    section_ids = request.json.get('section_ids')
    meta = json.loads(group['metadata'])
    meta['sections'] = section_ids

    set_group_metadata(group_id, meta)

    return MyResponse(True).to_json()


@bp.route("/test-study-1/set-inf-quiz", methods=['POST'])
@cross_origin()
@token_required
def test_study_1_set_inf_quiz(user: User):
    group_id = request.json.get('id')
    group = get_group(user, group_id, needs_edit_permission=True)
    if not group:
        return MyResponse(False, reason="Couldn't find group", status=404).to_json()
    
    inf_quiz_id = request.json.get('inf_quiz_id')
    meta = json.loads(group['metadata'])
    meta['inf_quiz'] = inf_quiz_id

    set_group_metadata(group_id, meta)

    return MyResponse(True).to_json()


@bp.route("/test-study-1/add-sections", methods=['POST'])
@cross_origin()
@token_required
def test_study_1_add_sections(user: User):
    group_id = request.json.get('id')
    group = get_group(user, group_id, needs_edit_permission=True)
    if not group:
        return MyResponse(False, reason="Couldn't find group", status=404).to_json()
    
    new_sections = request.json.get('section_ids')
    meta = json.loads(group['metadata'])
    if 'sections' in meta:
        meta['sections'].extend(new_sections)
    else:
        meta['sections'] = new_sections

    set_group_metadata(group_id, meta)

    return MyResponse(True).to_json()


# Adds/removes items from the group as appropriate (called after editing/removing group assets)
@bp.route("/test-study-1/refresh", methods=['POST'])
@cross_origin()
@token_required
def test_study_1_refresh_(user: User):
    group_id = request.json.get('id')
    group = get_group(user, group_id, needs_edit_permission=True)
    if not group:
        return MyResponse(False, reason="Couldn't find group", status=404).to_json()
    
    test_study_1_refresh(user, group)

    return MyResponse(True).to_json()


def test_study_1_refresh(user: User, group):
    all_curr_group_assets = get_assets_in_group(group['id'])

    metadata = json.loads(group['metadata'])
    section_asset_ids = metadata['sections']
    inf_quiz = metadata['inf_quiz'] if 'inf_quiz' in metadata else None
    section_assets = get_assets(user, section_asset_ids)
    
    section_quizzes = test_study_1_get_section_quizzes([x['id'] for x in section_assets])
    section_quiz_ids = [x for x in section_quizzes.values()]

    section_asset_ids = []
    assets_inside_sections = []
    quizzes_inside_sections = []
    for sec in section_assets:
        section_asset_ids.append(sec['id'])

        sec_state = get_section_state(user, sec['id'])
        if not sec_state:
            continue

        sources = get_sources(user, sec['id'])
        source_ids = [x['id'] for x in sources]
        assets_inside_sections.extend(source_ids)

        quizzes = sec_state['quizes'] if 'quizes' in sec_state and sec_state['quizes'] else {}  # "quizes" - a typo made long ago, now permanently etched in the DB.
        for key in quizzes:
            if int(key) in source_ids:
                quizzes_inside_sections.append(quizzes[key])

        section_quiz = [sec_state['sectionQuiz']] if 'sectionQuiz' in sec_state else []
        assets_inside_sections.extend(section_quiz)

    all_ids = [inf_quiz] + section_asset_ids + section_quiz_ids + assets_inside_sections + quizzes_inside_sections
    all_curr_ids = [x['id'] for x in all_curr_group_assets]
    
    curr_set = set(all_curr_ids)
    new_set = set(all_ids)
    to_remove = curr_set - new_set  # Elements in curr_set but not in new_set
    to_add = new_set - curr_set     # Elements in new_set but not in curr_set

    db = get_db()
    curr = db.cursor()

    # Add
    if len(to_add):
        sql = f"""
        UPDATE assets
        SET `group_id`=%s
        WHERE `id` IN ({",".join([str(x) for x in to_add])})
        """
        curr.execute(sql, (group['id'],))

    if len(to_remove):
        # Remove
        sql = f"""
        UPDATE assets
        SET `group_id`=%s
        WHERE `id` IN ({",".join([str(x) for x in to_remove])})
        """
        curr.execute(sql, (None,))

    db.commit()
