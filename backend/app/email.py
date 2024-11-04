from flask import (
    Blueprint, request
)
from .auth import token_required, User
from flask_cors import cross_origin
from .asset_actions import (
    get_asset
)
from .db import needs_db
from .template_response import MyResponse
from .exceptions import EmailFailed
import json
from .configs.user_config import MAX_EMAIL_LIMIT, MAX_EMAIL_WAIT, DEFAULT_EMAIL_SERVICE, EMAIL_FROM_ADDRESS, EMAIL_FROM_NAME, DISABLE_EMAILS
from .integrations.email import EMAIL_PROVIDERS, Email


bp = Blueprint('email', __name__, url_prefix="/email")


# recipients = ex. ["bobby@propane.net", ...]
# user is none if a user action did not trigger the sent email. Otherwise, a check is performed to prevent spam.
def send_email(recipients: list, subject: str, email_body: str, from_email=EMAIL_FROM_ADDRESS, from_name=EMAIL_FROM_NAME, user: User=None):  # should probably never change the from email.
    if DISABLE_EMAILS:
        return True
    
    if len(recipients) > MAX_EMAIL_LIMIT:
        raise EmailFailed(message=f"Too many recipients ({recipients})")
    
    if user:
        if not can_send_email(user):
            raise EmailFailed(message=f"User is doing this too much")

    email: Email = EMAIL_PROVIDERS[DEFAULT_EMAIL_SERVICE]
    email.send_email(recipients, subject, email_body, from_email=from_email, from_name=from_name)
    
    return True

# message_type = "email", or some other such thing.
@needs_db
def log_notif(message_type, n_recipients, metadata={}, endpoint=None, user_id=None, asset_id=None, db=None):
    sql = """
    INSERT INTO notifications (`message_type`, `n_recipients`, `metadata`, `endpoint`, `user_id`, `asset_id`)
    VALUES (%s, %s, %s, %s, %s, %s)
    """
    curr = db.cursor()
    args = (message_type, n_recipients, json.dumps(metadata), endpoint, user_id, asset_id)
    curr.execute(sql, args)
    return args

# Checks conditions to make sure user isn't spamming
@needs_db
def can_send_email(user: User, db=None):
    sql = f"""
    SELECT id FROM notifications
    WHERE `user_id` = %s AND `timestamp` > (NOW() - INTERVAL {MAX_EMAIL_WAIT} SECOND)
    """
    curr = db.cursor()
    curr.execute(sql, (user.user_id,))
    if curr.fetchone():
        return False
    return True

# Reminder of due assignments (mostly for Classroom probably)
REMINDER_ENDPOINT = 'reminder'
@bp.route(f'/{REMINDER_ENDPOINT}', methods=('POST',))
@cross_origin()
@token_required
def reminder(user: User):
    id = request.json.get('id')
    asset_row = get_asset(user, id)
    if not asset_row:
        return MyResponse(False, reason="Asset row not found", status=404).to_json()

    template_code = asset_row['template']
    from .templates.templates import get_template_by_code
    from .templates.template import Template
    tmp_obj: Template = get_template_by_code(template_code)

    if REMINDER_ENDPOINT not in tmp_obj.email_rules.allowed_endpoints:
        return MyResponse(False, reason="Emailing using this asset template is not allowed").to_json()

    if REMINDER_ENDPOINT in tmp_obj.email_rules.needs_edit_permission_endpoints:
        with_edit_perms = get_asset(user, id, needs_edit_permission=True)
        if not with_edit_perms:
            return MyResponse(False, reason="Emailing with this template requires edit permissions").to_json()
    
    data = request.json.get('data')

    email_info = tmp_obj.email_rules.get_email(user, asset_row, 'reminder', data)
    
    email_body = email_info['email_body']  # must have len = n recipients
    subject = email_info['subject']
    recipients = email_info['recipients']
    
    send_email(recipients, subject, email_body, user=user)
    log_notif('email', len(recipients),
        metadata=email_info,
        endpoint=REMINDER_ENDPOINT,
        user_id=user.user_id,
        asset_id=id,
    )

    return MyResponse(True).to_json()
