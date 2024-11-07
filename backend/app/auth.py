from flask import request
from app.db import needs_db
from functools import wraps
from .configs.user_config import PERMISSIONING, AUTH_SYSTEM
from .template_response import MyResponse
import requests
from .exceptions import UserIsNoneError
from .configs.str_constants import PERMISSIONS_REQUEST
from .integrations.auth import Auth, AUTH_PROVIDERS
from .utils import is_valid_email


# Represents a user from a token and holds only info that is encoded in the token
# For full user info, see FullUser in integrations/auth.py
# Fake means that we're arbitrary assigning email and user id
class User():
    email: str
    user_id: str
    def __init__(self, token, fake=False) -> None:
        if fake:
            return
        auth: Auth = AUTH_PROVIDERS[AUTH_SYSTEM]
        token_info = auth.extract_token_info(token)
        self.email = token_info['email']
        self.user_id = token_info['user_id']

    # Coupled with SynthUser
    def to_json(self):
        return {
            'email': self.email,
            'user_id': self.user_id
        }


# Used to create user object from existing user, but if user only is json.
class SynthUser(User):
    def __init__(self, obj) -> None:
        self.email = obj['email']
        self.user_id = obj['user_id']

# Inspired by https://www.bacancytechnology.com/blog/flask-jwt-authentication
# functions that use this should be patterned like so:
#       ... routes, other decorators
#       @token_required
#       def my_cool_func(current_user):
#           pass   
def token_required(f):
   @wraps(f)
   def decorator(*args, **kwargs):
        token = None
        if 'x-access-token' in request.headers:
            token = request.headers['x-access-token']
 
        if not token:
            return MyResponse(False, reason="Token missing").to_json()
        try:
            current_user = User(token)
        except Exception as e:
            return MyResponse(False, reason="Token invalid").to_json()
 
        return f(current_user, *args, **kwargs)
   return decorator


# Like token_required except the wrapped function is called with user=None if there's no token/token expired
def token_optional(f):
    @wraps(f)
    def decorator(*args, **kwargs):
        token = None

        # Means we're working outside regular context
        if not request:
            # Did the user pass an existing user object?
            # If so, use that.
            if len(args) > 0:
                if isinstance(args[0], User):
                    return f(*args, **kwargs)
            # Otherwise, raise an error.
            raise Exception("Tried to use token_optional, but working outside of request context and no user passed through.")

        if 'x-access-token' in request.headers:
            token = request.headers['x-access-token']

        if not token:
            return f(None, *args, **kwargs)

        current_user = None
        try:
            current_user = User(token)
        except Exception as e:
            pass
 
        return f(current_user, *args, **kwargs)
    return decorator


# Gets a line of SQL for the permissioning bit
# The assets table (or substitute) must include a `creator_id` column
# Assumes table aliases (corrected ones can be passed as args)
# The line follows the "WHERE " clause
@needs_db
def get_permissioning_string(user: User, get_public=True, user_uploads_only=False, edit_permission=False, assets_alias="a", asset_permissions_alias="ap", db=None):
    
    if PERMISSIONING == 'demo': 
        return "1 = 1"
    if not user and get_public:
        if edit_permission:
            return "1 = 0"
        return f"{asset_permissions_alias}.public != 0"
    elif not user:
        raise UserIsNoneError("Request for non-public data but no user")

    escaped_email = user.email
    
    email_domain = db.escape_string(escaped_email.split("@")[1]) if is_valid_email(escaped_email) else "localhost"  # localhost is somewhat of an arbitrary choice.

    user_id = db.escape_string(user.user_id)
    if user_uploads_only:
        return f"""{assets_alias}.creator_id LIKE '{user_id}'"""
    if edit_permission:
        return f"""{assets_alias}.creator_id LIKE '{user_id}' OR (({asset_permissions_alias}.email_domain LIKE '{email_domain}' OR {asset_permissions_alias}.email_domain LIKE '{escaped_email}' OR {asset_permissions_alias}.user_id LIKE '{user_id}') AND ap.can_edit=1)"""

    public = ""
    if get_public:
        public = f" OR {asset_permissions_alias}.public != 0"

    return f"""{asset_permissions_alias}.email_domain LIKE '{email_domain}' OR {asset_permissions_alias}.email_domain LIKE '{escaped_email}'{public} OR {assets_alias}.creator_id LIKE '{user_id}' OR {asset_permissions_alias}.user_id LIKE '{user_id}'"""


# Needs one of emails or user_ids
# Gets users by emails (should expand to more)
# Returns list of FullUser objects (not User objects)
def get_users(emails=[], user_ids=[]):
    auth: Auth = AUTH_PROVIDERS[AUTH_SYSTEM]
    users = auth.get_users(emails=emails, user_ids=user_ids)
    return users


# Getting if users have permissions to view things about other users
# Finds permissions_request entries for a given asset and confirms user as ability to access asset
@needs_db
def get_cross_permissions(id, db=None):
    sql = f"""
        SELECT * FROM asset_metadata
        WHERE `asset_id`=%s AND `key`='{PERMISSIONS_REQUEST}' AND (`value`=1 OR `value`=0)
    """
    curr = db.cursor()
    curr.execute(sql, (id,))

    res = curr.fetchall()

    return res
