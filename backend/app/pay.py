import os
from flask import (
    Blueprint,
    request,
    session,
)
import json
import stripe
from flask_cors import cross_origin
from .db import get_db, needs_db, with_lock
from .auth import User, token_required, token_optional
from .configs.secrets import FRONTEND_URL, DB_TYPE
from .configs.user_config import DEFAULT_SUBSCRIPTION_CODE, SUBSCRIPTION_CODE_TO_MODEL_OPTIONS, DEFAULT_PRODUCT_ID
from .template_response import MyResponse
from .configs.str_constants import USER_CHECKOUT_SESSION, USER_SUBSCRIPTION
from .groups import add_group_permission_by_product_id
import math

bp = Blueprint('pay', __name__, url_prefix="/pay")

DEFAULT_SEARCH_LIMIT = 20  # not in user config because rarely needed


"""

OUTLINE

--> User clicks button on frontend, requests /create-checkout-session
--> Backend matches product id in database to get stripe price lookup key 
-—> generates stripe session using price lookup key
--> adds metadata to session including product id and user id
-—> also store checkout session info in user metadata
-—> send to frontend session id

-—> user is redirected to stripe
-—> stripe completes payment, redirects to specific page on frontend
-—> frontend pings backend to check for sessions

-—> backend looks at user metadata, sees unresolved session, pings stripe using session id to see if complete
-—> if complete, resolve according to resolution protocol in DB (product table) - for subscription, add a subscription in user metadata; otherwise, maybe add an asset permission for an asset group; or whatever.
-—> mark session as resolved

"""


@needs_db
def get_product(id, db=None):
    sql = "SELECT * FROM products WHERE `id`=%s"
    curr = db.cursor()
    curr.execute(sql, id)
    res = curr.fetchone()
    return res

@needs_db
def get_products(ids, db=None):
    if not ids or not len(ids):
        return []
    placeholders = ', '.join(['%s'] * len(ids))
    sql = f"""
    SELECT * FROM products
    WHERE `id` IN ({placeholders})
    """
    db = get_db()
    curr = db.cursor()
    curr.execute(sql, ids)
    results = curr.fetchall()
    return results


# Just a struct for keeping track of a subscription
class Subscription():
    active: bool
    product_id: int
    stripe_cus_id: str
    stripe_checkout_session_id: str
    stripe_sub_id: str
    def __init__(self, active: bool, product_id: int, stripe_cus_id, stripe_checkout_session_id, stripe_sub_id) -> None:
        self.stripe_cus_id = stripe_cus_id
        self.stripe_checkout_session_id = stripe_checkout_session_id
        self.stripe_sub_id = stripe_sub_id

        self.active = active
        self.product_id = product_id

    def to_json_obj(self):
        obj = {
            'active': self.active,
            'product_id': self.product_id,
            'stripe_cus_id': self.stripe_cus_id,
            'stripe_checkout_session_id': self.stripe_checkout_session_id,
            'stripe_sub_id': self.stripe_sub_id
        }
        return obj


class SubscriptionFromJsonObj(Subscription):
    def __init__(self, obj) -> None:
        product_id = obj['product_id'] if 'product_id' in obj else DEFAULT_PRODUCT_ID  # for backwards compatibility... abbey cathedral should have id=2 in database (in dev and prod)
        super().__init__(obj['active'], product_id, obj['stripe_cus_id'], obj['stripe_checkout_session_id'], obj['stripe_sub_id'])


# Defines how to deal with different kinds of products
class Protocol():
    code: str
    def __init__(self, code) -> None:
        self.code = code
    
    def create_checkout(self, user: User, product_row, prices, addl_data={}):
        raise Exception(f"Create checkout not implemented for {self.code}")
    
    @needs_db
    def resolve(self, user, product_row, stripe_session, db=None):
        raise Exception(f"Resolve not implemented for {self.code}")

class MainSub(Protocol):
    def __init__(self) -> None:
        super().__init__('main-sub')

    def create_checkout(self, user: User, product_row, prices, addl_data={}):
        checkout_session = stripe.checkout.Session.create(
            line_items=[
                {
                    'price': prices.data[0].id,
                    'quantity': 1,
                },
            ],
            mode='subscription',  # as opposed to a one time payment
            success_url=FRONTEND_URL + "/settings",
            cancel_url=FRONTEND_URL + "/settings",
            metadata={'user_id': user.user_id, 'product_id': product_row['id']}
        )
        return checkout_session.id
    
    @needs_db
    def resolve(self, user, product_row, stripe_session, db=None, no_commit=False, addl_data={}):
        # Add a subscription to the user's metadata
        cust = ""
        session_id = ""
        stripe_sub_id = ""
        if stripe_session:
            cust = stripe_session.customer
            session_id = stripe_session.id
            stripe_sub_id = stripe_session.subscription

        sub = Subscription(True, product_row['id'], cust, session_id, stripe_sub_id)
        add_subscription(user, sub, db=db, no_commit=no_commit)


class AddPermGroup(Protocol):  # "add permission (for asset) group"
    def __init__(self) -> None:
        super().__init__('add-group-perm')

    def create_checkout(self, user: User, product_row, prices, addl_data):
        assert('group_id' in addl_data)  # need it for return URL
        checkout_session = stripe.checkout.Session.create(
            line_items=[
                {
                    'price': prices.data[0].id,
                    'quantity': 1,
                },
            ],
            mode='payment',  # This is what differentiates it from subscription
            success_url=FRONTEND_URL + f"/groups/{addl_data['group_id']}",
            cancel_url=FRONTEND_URL + f"/groups/{addl_data['group_id']}",
            metadata={'user_id': user.user_id, 'product_id': product_row['id']}
        )
        return checkout_session.id


    @needs_db
    def resolve(self, user, product_row, stripe_session, db=None, no_commit=False):
        # Add correct group permission
        add_group_permission_by_product_id(user, product_row['id'], db=db, no_commit=no_commit)


PROTOCOLS = [MainSub(), AddPermGroup()]

def get_protocol_by_code(code):
    for prot in PROTOCOLS:
        prot: Protocol
        if prot.code == code:
            return prot
    raise Exception(f"Unrecognized protocol code {code}")


# Gives subscription object of user's main sub
@needs_db
def get_active_main_sub(user: User, db=None) -> Subscription:
    assert(user)
    assert(user.user_id)
    
    sql = """
    SELECT * FROM user_metadata
    WHERE `key`=%s
      AND `user_id`=%s
      AND JSON_VALID(`value`)
      AND JSON_EXTRACT(`value`, '$.active') = true;
    """
    curr = db.cursor()
    curr.execute(sql, (USER_SUBSCRIPTION, user.user_id))
    res = curr.fetchone()

    if not res:
        return None

    val = res['value']
    meta = json.loads(val)
    sub = SubscriptionFromJsonObj(meta)

    return sub


@needs_db
def get_user_main_sub_code(user: User, db=None) -> str:
    sub: Subscription = get_active_main_sub(user, db=db)
    if not sub:
        return DEFAULT_SUBSCRIPTION_CODE
    prod_id = sub.product_id
    prod = get_product(prod_id)
    return prod['code']  # all main subs should have a code



@needs_db
def record_checkout_session(user: User, session_id, db=None):
    assert(user)
    assert(user.user_id)
    metadata = {'session_id': session_id, 'resolved': False}
    from .user import set_user_metadata
    set_user_metadata(user, USER_CHECKOUT_SESSION, json.dumps(metadata))


@needs_db
def get_unresolved_checkout_sessions(user: User, db=None):
    assert(user)
    assert(user.user_id)

    sql = """
    SELECT * FROM user_metadata
    WHERE `user_id`=%s AND `key`=%s AND JSON_VALID(`value`) AND JSON_EXTRACT(`value`, '$.resolved') = false
    ORDER BY `time_uploaded` DESC
    """
    curr = db.cursor()
    curr.execute(sql, (user.user_id, USER_CHECKOUT_SESSION))
    res = curr.fetchall()
    return res


@needs_db
def mark_checkout_session_resolved(row_id, session_id, db=None):
    sql = """
    UPDATE user_metadata
    SET `value`=%s
    WHERE `id`=%s
    """
    val = json.dumps({
        'session_id': session_id,
        'resolved': True
    })
    curr = db.cursor()
    curr.execute(sql, (val, row_id))


# Creates an active subscription for a user
# Does NOT handle stripe information.
@needs_db
def add_subscription(user: User, sub: Subscription, db=None):
    data = sub.to_json_obj()
    from .user import set_user_metadata
    set_user_metadata(user, USER_SUBSCRIPTION, json.dumps(data))


# Does not affect stripe
@needs_db
def deactivate_subscription(user: User, db=None):
    assert(user)
    assert(user.user_id)
    
    sql = """
    UPDATE user_metadata
    SET value = JSON_REPLACE(value, '$.active', false)
    WHERE `user_id`=%s
      AND `key`=%s
      AND JSON_VALID(`value`)
    """

    curr = db.cursor()
    curr.execute(sql, (user.user_id, USER_SUBSCRIPTION))

    # Change user model if needed

    # Dynamic import due to circular import.
    from .user import get_user_chat_model_code, select_user_chat_model

    model_code = get_user_chat_model_code(user, db=db)
    kosher_options = SUBSCRIPTION_CODE_TO_MODEL_OPTIONS[DEFAULT_SUBSCRIPTION_CODE]
    
    if model_code not in kosher_options:
        select_user_chat_model(user, kosher_options[0], db=db)


# Returns list of checkout sessions that are resolved positively
@needs_db
def resolve_active_checkout_sessions(user: User, db=None, no_commit=False):
    lock_name = f'resolve_checkout_{user.user_id}'
    @with_lock(lock_name, db)
    def resolve():
        curr = db.cursor()

        # It never undoes itself, so technically unncessary after the first time
        if DB_TYPE == 'local':
            curr.execute("SET GLOBAL TRANSACTION ISOLATION LEVEL READ COMMITTED;")

        rows = get_unresolved_checkout_sessions(user)

        resolved_sessions = []
        for row in rows:
            meta = json.loads(row['value'])
            session_id = meta['session_id']

            session: stripe.checkout.Session = stripe.checkout.Session.retrieve(session_id)

            # Session status is complete, expired, or open (stripe API)
            if session.status == 'complete':

                # is it paid?
                if session.payment_status != 'unpaid':  # could be, payment_not_required
                    meta = session.metadata

                    # All checkout sessions should have an id into the products table
                    product_id = meta['product_id']
                    product_row = get_product(product_id, db=db, no_commit=True)

                    # Find the correct resolution protocol
                    prot: Protocol = get_protocol_by_code(product_row['resolution_protocol'])
                    prot.resolve(user, product_row, session, db=db, no_commit=True)

                    mark_checkout_session_resolved(row['id'], session_id, db=db, no_commit=no_commit)

                    resolved_sessions.append(row)

            elif session.status == 'expired':
                mark_checkout_session_resolved(row['id'], session_id, no_commit=no_commit)
            else:  # still open - don't resolve.
                pass

        return resolved_sessions

    return resolve()


def get_discount_code(user, product_id):
    if not user:
        return None

    from .user import get_user_product_codes
    used_codes = get_user_product_codes(user)
    codes_for_this_prod = [x for x in used_codes if x['product_id'] == product_id]
    if len(codes_for_this_prod):
        # Use the cheapest one
        cheapest = min(codes_for_this_prod, key=lambda x: int(x['new_price_cents']) if x['new_price_cents'] else math.inf)  # why inf? because if a total/free code has been entered, we don't want to choose that. Basically only happens in testing where a purchase has been taken away.
        return cheapest
    return None


@bp.route('/create-checkout-session', methods=['POST'])
@cross_origin()
@token_required
def create_checkout_session(user: User):

    product_id = request.json.get('product_id')  # no product ID means Cathedral
    addl_data = request.json.get('addl_data')
    if not product_id:
        product_id = DEFAULT_PRODUCT_ID

    product = get_product(product_id)
    splk = product['stripe_price_lookup_key']  # the default price

    # Get any use codes used for this product
    product_code = get_discount_code(user, product_id)
    if product_code and product_code['stripe_price_lookup_key']:
        splk = product_code['stripe_price_lookup_key']

    protocol: Protocol = get_protocol_by_code(product['resolution_protocol'])

    prices = stripe.Price.list(
        lookup_keys=[splk],
        expand=['data.product']
    )

    checkout_session_id = protocol.create_checkout(user, product, prices, addl_data=addl_data)
    
    record_checkout_session(user, checkout_session_id)

    return MyResponse(True, {'id': checkout_session_id}).to_json()


@bp.route('/get-subscription', methods=['POST'])
@cross_origin()
@token_required
def get_subscriptions_(user: User):

    assert(user)
    assert(user.user_id)

    # First, resolve any unresolved checkout sessions
    # Then get the user's active main subscription
    db = get_db()

    resolve_active_checkout_sessions(user, db=db)

    code = get_user_main_sub_code(user, db=db)
    
    db.close_cursors()

    return MyResponse(True, {'subscription_code': code}).to_json()


@bp.route('/cancel-subscription', methods=['POST'])
@cross_origin()
@token_required
def cancel_subscription_(user: User):
    sub_to_remove: Subscription = get_active_main_sub(user)

    if not sub_to_remove:
        return MyResponse(False, status=400, reason="No user subscription active.").to_json()
    
    sub_id = sub_to_remove.stripe_sub_id

    # Immediately removes the subscription.
    # Doesn't cancel at end of period.
    if sub_id:
        stripe.Subscription.delete(sub_id)

    deactivate_subscription(user)  # deactives all user main subs (USER_SUBSCRIPTIONs) - by rule, should only have one

    # Return the subscription we just deactivated (note: it will still say Active).
    return MyResponse(True, {'subscription': sub_to_remove.to_json_obj()}).to_json()


# No need for any permissioning here, right?
@bp.route('/product', methods=['GET'])
@token_optional
@cross_origin()
def _get_product(user: User):
    product_id = request.args.get('id', None, type=int)
    if not product_id:
        return MyResponse(False, reason=f"Product ID not specified").to_json()
    
    prod = get_product(product_id)
    if not prod:
        return MyResponse(False, reason=f"No product with ID {product_id}", status=404).to_json()

    # Send discount information as well if available
    discount = get_discount_code(user, product_id)

    return MyResponse(True, {'result': prod, 'discount': discount}).to_json()
