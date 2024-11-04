from flask import (
    Blueprint,
    request,
    request,
)
from flask_cors import cross_origin
from .integrations.lm import LM_PROVIDERS, LM
from .integrations.tts import TTS, TTS_PROVIDERS
from .configs.str_constants import USER_CHAT_MODEL, USER_TTS_MODEL, USER_PRODUCT_CODE, USER_PIN, USER_UPLOAD_COUNTER, USER_ALERT_ACTIVITY
from .auth import User, token_required
from .db import get_db, needs_db
from .template_response import MyResponse
from .configs.user_config import (
    OVERRIDE_ALLOWED_TEMPLATES, DEFAULT_OCR_OPTION,
    SUBSCRIPTION_CODE_TO_MODEL_OPTIONS, DEFAULT_CHAT_MODEL,
    SUBSCRIPTION_CODE_TO_OCR_OPTIONS, SUBSCRIPTION_CODE_TO_TEMPLATES,
    SUBSCRIPTION_CODE_TO_TTS_OPTIONS, DEFAULT_TTS_MODEL,
    SUBSCRIPTION_CODE_TO_TOTAL_ASSET_LIMITS, DISABLE_OCR, LM_ORDER
)
from .pay import get_user_main_sub_code, Protocol, get_protocol_by_code, get_product, get_products
import pytz
from datetime import datetime
import math
import json
from .activity import make_log, get_user_activity
from .utils import compare_db_times

bp = Blueprint('user', __name__, url_prefix="/user")


@needs_db
def get_user_templates(user: User, db=None):
    if user is None:
        if OVERRIDE_ALLOWED_TEMPLATES is None:
            return []
        else:
            return OVERRIDE_ALLOWED_TEMPLATES
    prod: str = get_user_main_sub_code(user, db=db)
    lst = SUBSCRIPTION_CODE_TO_TEMPLATES[prod]
    return lst


@needs_db
def get_user_ocr_option(user: User, db=None):
    # TODO: check the user's preference in metadata!
    # user_type = get_user_main_sub_code(user, db=db)
    # lst = SUBSCRIPTION_CODE_TO_OCR_OPTIONS[user_type]
    if DISABLE_OCR:
        return 'disabled'
    return DEFAULT_OCR_OPTION


@needs_db
def get_user_chat_model_options_codes(user: User, db=None):
    code = get_user_main_sub_code(user, db=db)
    lst = SUBSCRIPTION_CODE_TO_MODEL_OPTIONS[code]
    return lst


@needs_db
def get_user_tts_options_codes(user: User, db=None):
    code = get_user_main_sub_code(user, db=db)
    lst = SUBSCRIPTION_CODE_TO_TTS_OPTIONS[code]
    return lst


@needs_db
def get_user_chat_model_code(user: User, db=None):
    
    if not user:
        raise Exception("No user provided")
    
    results = get_user_metadata(user, key=USER_CHAT_MODEL, db=db)

    model = DEFAULT_CHAT_MODEL
    if results and len(results):
        model = results[0]['value']
    
    return model


@needs_db
def get_user_tts_model_code(user: User, db=None):
    
    if not user:
        raise Exception("No user provided")
    
    results = get_user_metadata(user, key=USER_TTS_MODEL)
    model = DEFAULT_TTS_MODEL
    if results and len(results):
        model = results[0]['value']
    
    return model


# NOTE: Doesn't check to see if user has access to model (but endpoint does)
@needs_db
def select_user_chat_model(user: User, code: str, db=None):
    if not user:
        raise Exception("No user provided")
    set_user_metadata(user, USER_CHAT_MODEL, code, replace=True)


# NOTE: Doesn't check to see if user has access to model (but endpoint does)
@needs_db
def select_user_tts_model(user: User, code: str, db=None):
    if not user:
        raise Exception("No user provided")
    set_user_metadata(user, USER_TTS_MODEL, code, replace=True)


@needs_db
def inc_upload_counter(user, template, db=None):
    existing = get_user_assets_sum(user)
    for_template = [x for x in existing if x['template'] == template]
    if len(for_template):
        for_template[0]['count'] += 1
    else:
        existing.append({'template': template, 'count': 1})
    set_user_metadata(user, USER_UPLOAD_COUNTER, json.dumps(existing), replace=True, db=db)


# Returns list of {'template':..., 'count': ...}
@needs_db
def get_user_assets_sum(user: User, db=None):
    uc = get_user_metadata(user, key=USER_UPLOAD_COUNTER)
    if not uc or not len(uc):
        return []
    val = json.loads(uc[0]['value'])
    return val


@needs_db
def get_user_allowed_new_upload(user, db=None):
    sums = get_user_assets_sum(user, db=db)
    main_sub_code = get_user_main_sub_code(user)
    limit = SUBSCRIPTION_CODE_TO_TOTAL_ASSET_LIMITS[main_sub_code]
    return sum([x['count'] for x in sums]) < limit


# Get recent uploads
@needs_db
def get_recent_uploads(user: User, templates=[], limit=5, interval="3 DAY", db=None):
    args = []
    sql = f"""
    SELECT * FROM assets
    WHERE `creator_id`=%s
    AND `time_uploaded` >= DATE_SUB(CURDATE(), INTERVAL {interval})
    """
    args.append(user.user_id)
    if templates and len(templates):
        sql += f"AND `template` IN ('document', 'website')\n"
    sql += "ORDER BY `time_uploaded` DESC LIMIT %s"
    args.append(limit)
    curr = db.cursor()
    curr.execute(sql, args)
    res = curr.fetchall()
    return res



@bp.route('/asset-counts', methods=('GET',))
@cross_origin()
@token_required
def asset_counts(user: User):
    main_sub_code = get_user_main_sub_code(user)
    limit = SUBSCRIPTION_CODE_TO_TOTAL_ASSET_LIMITS[main_sub_code]
    if limit == math.inf:
        limit = "inf"
    return MyResponse(True, {'results': get_user_assets_sum(user), 'limit': limit}).to_json()



@bp.route('/templates', methods=('GET',))
@cross_origin()
@token_required
def templates(user: User):
    return MyResponse(True, {'results': get_user_templates(user)}).to_json()


@bp.route('/chat-models', methods=('GET',))
@cross_origin()
@token_required
def get_user_chat_model_options_(user: User):

    available = []
    unavailable = []

    codes = get_user_chat_model_options_codes(user)
    for lm_code in LM_ORDER:
        lm: LM = LM_PROVIDERS[lm_code]
        if lm_code in codes:
            available.append(lm.to_json_obj())
        else:
            unavailable.append(lm.to_json_obj())

    return MyResponse(True, {'available': available, 'unavailable': unavailable}).to_json()


@bp.route('/tts-models', methods=('GET',))
@cross_origin()
@token_required
def get_user_tts_model_options_(user: User):

    available = []
    unavailable = []

    codes = get_user_tts_options_codes(user)
    for tts in TTS_PROVIDERS.values():
        tts: TTS
        if tts.code in codes:
            available.append(tts.to_json_obj())
        else:
            unavailable.append(tts.to_json_obj())

    return MyResponse(True, {'available': available, 'unavailable': unavailable}).to_json()



@bp.route('/chat-model', methods=('GET',))
@cross_origin()
@token_required
def get_user_model_options_(user: User):
    code = get_user_chat_model_code(user)
    model: LM = LM_PROVIDERS[code]
    return MyResponse(True, {'model': model.to_json_obj()}).to_json()


@bp.route('/tts-model', methods=('GET',))
@cross_origin()
@token_required
def get_user_tts_options_(user: User):
    code = get_user_tts_model_code(user)
    model: TTS = TTS_PROVIDERS[code]
    return MyResponse(True, {'model': model.to_json_obj()}).to_json()



@bp.route('/select-chat-model', methods=('POST',))
@cross_origin()
@token_required
def select_user_chat_model_(user: User):
    code = request.json.get('model')
    codes = get_user_chat_model_options_codes(user)
    if code not in codes:
        return MyResponse(False, status=403)
    
    select_user_chat_model(user, code)

    model: LM = LM_PROVIDERS[code]
    
    return MyResponse(True, {'model': model.to_json_obj()}).to_json()



@bp.route('/select-tts-model', methods=('POST',))
@cross_origin()
@token_required
def select_user_tts_model_(user: User):
    code = request.json.get('model')
    codes = get_user_tts_options_codes(user)
    if code not in codes:
        return MyResponse(False, status=403)
    
    select_user_tts_model(user, code)

    model: TTS = TTS_PROVIDERS[code]
    
    return MyResponse(True, {'model': model.to_json_obj()}).to_json()


@bp.route('/needs-attention', methods=('GET',))
@cross_origin()
@token_required
def needs_attention(user: User):
    
    if not user:
        return MyResponse(True, {'results': []}).to_json()

    MAX_TIME = 30  # in days, when a needs-attention will no longer be shown

    sql = f"""
        SELECT asset_metadata.*, assets.template, assets.title
        FROM asset_metadata
        INNER JOIN assets ON asset_metadata.asset_id = assets.id
        WHERE asset_metadata.user_id = %s 
            AND asset_metadata.needs_attention IS NOT NULL 
            AND asset_metadata.needs_attention != 0
            AND asset_metadata.time_uploaded > (NOW() - INTERVAL {MAX_TIME} DAY)
        ORDER BY asset_metadata.time_uploaded
    """
    db = get_db()
    curr = db.cursor()
    curr.execute(sql, (user.user_id,))

    res = curr.fetchall()
    if not res:
        return MyResponse(True, {'results': []}).to_json()

    return MyResponse(True, {'results': res}).to_json()


@bp.route('/needs-attention-respond', methods=('POST',))
@cross_origin()
def needs_attention_respond():  # permissioned on template side

    template_code = request.json.get('template')
    asset_metadata_row = request.json.get('asset_metadata_row')  # may also include things like asset template, asset title b/c that's what needs-attention returns
    data = request.json.get('data')

    from .templates.templates import get_template_by_code
    from .templates.template import Template
    tmp: Template = get_template_by_code(template_code)
    tmp_data = tmp.process_needs_attention_response(asset_metadata_row, data)

    return MyResponse(True, {'template_data': tmp_data}).to_json()


@bp.route('/toggle-pin', methods=('POST',))
@cross_origin()
@token_required
def toggle_pin(user: User):
    asset_id = request.json.get('id')
    off = request.json.get('off')
    if off is None:
        return MyResponse(False, reason="Must specify whether the toggle is on or off").to_json()
    
    if off:
        delete_user_metadata(user, USER_PIN, asset_id)
    else:
        set_user_metadata(user, USER_PIN, asset_id, replace=False)

    return MyResponse(True).to_json()


@bp.route('/pins', methods=('GET',))
@cross_origin()
@token_required
def get_pins(user: User):
    sql = """
    SELECT * FROM assets a
    INNER JOIN user_metadata um
    ON um.value = a.id
    WHERE um.user_id=%s AND um.key=%s
    """
    db = get_db()
    curr = db.cursor()
    curr.execute(sql, (user.user_id, USER_PIN))
    res = curr.fetchall()
    return MyResponse(True, {'results': res}).to_json()


@needs_db
def delete_user_metadata(user: User, key, value, db=None):
    curr = db.cursor()
    delete_sql = """
    DELETE FROM user_metadata
    WHERE `user_id`=%s AND `key`=%s AND `value`=%s
    """
    curr.execute(delete_sql, (user.user_id, key, value))


@needs_db
def set_user_metadata(user: User, key, value, db=None, replace=True):
    curr = db.cursor()
    
    if replace:
        # Delete any existing row with the same user_id and key
        delete_sql = """
        DELETE FROM user_metadata
        WHERE `user_id`=%s AND `key`=%s
        """
        curr.execute(delete_sql, (user.user_id, key))
    
    # Insert the new row
    insert_sql = """
    INSERT INTO user_metadata (`user_id`, `key`, `value`)
    VALUES (%s, %s, %s)
    """
    curr.execute(insert_sql, (user.user_id, key, value))
    
    cid = curr.lastrowid
    return cid

# Key and value are optional
@needs_db
def get_user_metadata(user: User, key=None, value=None, db=None):
    curr = db.cursor()
    
    # Base SQL query
    sql = """
    SELECT *
    FROM user_metadata
    WHERE `user_id` = %s
    """
    
    params = [user.user_id]
    
    # Add conditions for key and value if they are not None
    if key is not None:
        sql += " AND `key` = %s"
        params.append(key)
    
    if value is not None:
        sql += " AND `value` = %s"
        params.append(value)

    sql += "\nORDER BY `time_uploaded` DESC"
    
    curr.execute(sql, params)
    res = curr.fetchall()
    return res


def get_product_code(code):
    sql = """
    SELECT * FROM product_codes
    WHERE `value`=%s
    """
    db = get_db()
    curr = db.cursor()
    curr.execute(sql, code)

    res = curr.fetchone()
    return res


def get_product_codes_by_ids(ids):
    placeholders = ', '.join(['%s'] * len(ids))
    sql = f"""
    SELECT * FROM product_codes
    WHERE `id` IN ({placeholders})
    """
    db = get_db()
    curr = db.cursor()
    curr.execute(sql, ids)
    results = curr.fetchall()
    return results


@needs_db
def mark_code_as_used(user: User, product_code_id, db=None, no_commit=False):
    set_user_metadata(user, USER_PRODUCT_CODE, product_code_id, db=db, no_commit=no_commit, replace=False)


def get_user_product_codes(user: User):
    metas = get_user_metadata(user, key=USER_PRODUCT_CODE)
    product_code_ids = [x['value'] for x in metas]
    if not len(product_code_ids):
        return []
    results = get_product_codes_by_ids(product_code_ids)
    return results


@bp.route('/validate-code', methods=('POST',))
@cross_origin()
@token_required
def validate_code(user: User):
    code = request.json.get('code')
    res = get_product_code(code)
    if not res:
        return MyResponse(False, reason="No matching code found", status=404).to_json()  # we love an early return, don't we folks?
    
    user_product_codes = get_user_product_codes(user)
    if res['id'] in [x['id'] for x in user_product_codes]:
        return MyResponse(False, reason="Already used this code").to_json()
    
    expiration = res['expiration']
    expiration_utc = datetime.strptime(expiration, "%Y-%m-%d %H:%M:%S").replace(tzinfo=pytz.utc)  # assuming db holds times in UTC, which I think is true OK
    current_time_utc = datetime.now(pytz.utc)
    if expiration_utc < current_time_utc:
        return MyResponse(False, reason="Code is expired").to_json()
    
    product_row = get_product(res['product_id'])
    db = get_db(exclusive_conn=True)
    
    # Is this a discount code or a total/free code?
    # --> determined by whether there's a new price or no price.
    if not res['stripe_price_lookup_key']:
        # We need to give the user access!
        # Find the correct resolution protocol
        prot: Protocol = get_protocol_by_code(product_row['resolution_protocol'])
        prot.resolve(user, product_row, None, db=db, no_commit=True)

    # If it's a discount code, marking the code as used will 
    mark_code_as_used(user, res['id'], db=db)  # should commit

    code_for = product_row['name']
    return MyResponse(True, {'for': code_for}).to_json()


@bp.route('/codes', methods=('GET',))
@cross_origin()
@token_required
def _get_user_codes(user: User):
    product_codes = get_user_product_codes(user)
    products = get_products([x['product_id'] for x in product_codes])
    products_dict = {x['id']: x for x in products}
    return MyResponse(True, {'product_codes': product_codes, 'products_dict': products_dict}).to_json()


@bp.route('/alert', methods=('GET',))
@cross_origin()
@token_required
def asset_alert(user: User):

    # That this function seems so template specific is not good
    # But unclear if we would want to extend this functionality in the near future to be relatively template agnostic
    # Also - there might be different ways for different purposes. So how?
    # So, that's TODO

    UPLOAD_THRESH = 3
    MAX_ASSETS = 3

    recents = get_recent_uploads(user, templates=['notebook', 'document', 'website', 'video'],  limit=10, interval="5 DAY")
    responses = get_user_activity(user, USER_ALERT_ACTIVITY, limit=1)
    last_response = responses[0] if len(responses) else None

    uploads_since_last_notebook = []
    for x in recents:
        if x['template'] == 'notebook':
            break
        if (last_response is not None) and (compare_db_times(x['time_uploaded'], last_response['timestamp']) < 0):
            break
        uploads_since_last_notebook.append(x)
    
    if len(uploads_since_last_notebook) >= UPLOAD_THRESH:
        new_assets = uploads_since_last_notebook[:MAX_ASSETS]
        return MyResponse(True, {'type': 'combine-into-notebook', 'data': {'results': new_assets}}).to_json()
    
    return MyResponse(True).to_json()


@bp.route('/alert-respond', methods=('POST',))
@cross_origin()
@token_required
def asset_alert_respond(user: User):

    # Again - this should probably work as a system like notifications, templates, LMs, etc. so that we can expand the number and types of alerts
    # But with N=1 currently, doesn't make sense to introduce so much complication

    asset_id = request.json.get('id')
    accepted = request.json.get('accepted')
    alert_type = request.json.get('type')
    alert_data = request.json.get('data')

    stored_txt = json.dumps({'accepted': accepted, 'alert_type': alert_type, 'alert_data': alert_data})
    make_log(user, asset_id, None, USER_ALERT_ACTIVITY, stored_txt)
    
    if not accepted:
        return MyResponse(True).to_json()

    if alert_type == 'combine-into-notebook':  # as stated above - can be refactored in the future
        from .templates.notebook import make_notebook
        included_assets = alert_data['results']
        new_asset_id = make_notebook(user, included_assets)
        return MyResponse(True, {'id': new_asset_id}).to_json()

    
    return MyResponse(True).to_json()
