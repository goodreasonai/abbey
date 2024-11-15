from .storage_interface import delete_resources
from .exceptions import NoCreateError, UserIsNoneError
from .auth import SynthUser, User
from .configs.user_config import ALLOW_PUBLIC_UPLOAD
import json
from .auth import get_permissioning_string
from .db import get_db, needs_db, with_lock, needs_special_db, ProxyDB, PooledCursor
from .retriever import consistency_check, Retriever
from .configs.secrets import DB_TYPE, FRONTEND_URL
from .configs.str_constants import CHAT_CONTEXT, SUMMARY_APPLY_JOB, SUMMARY_PAIRWISE_JOB, HAS_EDITED_ASSET_TITLE, HAS_EDITED_ASSET_DESC, PROTECTED_METADATA_KEYS, RETRIEVAL_SOURCE, BOOK_ORDER
from .jobs import complete_job, job_error_wrapper, start_job
from .configs.str_constants import RETRIEVAL_SOURCE
from .configs.user_config import ILLEGAL_SHARE_DOMAINS, MAX_CHAT_RETRIEVER_RESULTS, FAST_CHAT_MODEL
from .prompts.suggest_questions_prompts import get_suggest_questions_system_prompt, get_suggest_questions_prompt, get_suggest_questions_system_prompt_detached
from .integrations.lm import LM_PROVIDERS, LM
from .utils import is_valid_email
from .prompts.summary_prompts import get_summary_apply_instructions, get_summary_reduce_instructions
from .worker import task_apply, task_general
import pickle
from .reducer import Reducer
import tempfile
from .storage_interface import upload_asset_file
import os

# DO NOT IMPORT ANYTHING FROM templates.py (if needed, do dynamic import)

"""

Everything here should NOT return a Response

Things that can be called from assets.py, or elsewhere.

"""

# Not permissioned
@needs_db
def get_permissions(asset_id, no_joints=False, db=None):
    sql = f"""
    SELECT * FROM asset_permissions WHERE `asset_id`=%s
    {"AND `joint_asset_id` IS NULL" if no_joints else ""}
    """
    curr = db.cursor()
    curr.execute(sql, (asset_id,))
    res = curr.fetchall()
    return res


# Permissioned
# keys is a list of unsanitized text, limit and offset are ints
# If you need get_total, use an exclusive connection.
# **Will return all asset metadata for those keys not in PROTECTED_METADATA_KEYS in str_constants (otherwise just user's)**
# for_all_users=True returns metadata for all users, even if key is user specific
@needs_db
def get_asset_metadata(user: User, asset_id, keys=None, limit=None, offset=None, get_total=True, reverse=False, for_all_users=False, db=None):
    
    curr = db.cursor()

    key_text = ""
    if keys is not None and len(keys) > 0:
        key_list = [f"`key`='{db.escape_string(str(x))}'" for x in keys]
        key_text = f" AND ({' OR '.join(key_list)})"

    order_by_clause = "ORDER BY `time_uploaded` " + ("ASC" if reverse else "DESC")

    limit_text = ""
    if limit:
        limit_text = f"LIMIT {limit}"
    
    offset_text = ""
    if offset:
        offset_text = f"OFFSET {offset}"

    """
    Can user see this metadata flow:

    Does the user have access to this asset?
        --> No: No
        --> Yes: Is the metadata user specific, either specified via template or PROTECTED_METADATA_KEYS?
            --> Yes: Only if the the metadata has matching user_id
            --> No: Is the key hidden from users without edit permission?
                --> Yes: Yes if the user has edit permission
                --> No: Yes
    
    ** All metadata can be viewed by view permissions holders, except user specific or those expclitly hidden to non-editing users **
    """

    asset_row = get_asset(user, asset_id, db=db)
    if not asset_row:
        raise Exception(f"Could not find asset with id '{asset_id}'")

    from .templates.template import Template
    from .templates.templates import get_template_by_code
    tmp: Template = get_template_by_code(asset_row['template'])
    protected_keys = tmp.metadata_user_specific + PROTECTED_METADATA_KEYS
    for non_user in tmp.metadata_non_user_specific:
        protected_keys.remove(non_user)

    protected_key_list = [f"'{x}'" for x in protected_keys]
    protected_key_list_text = f"({','.join(protected_key_list)})"

    protected_text = ""
    if not for_all_users:
        if user and len(protected_key_list) > 0:
            protected_text = f" AND (`user_id`='{db.escape_string(user.user_id)}' OR `key` NOT IN {protected_key_list_text})"
        elif len(protected_key_list):
            protected_text = f" AND `key` NOT IN {protected_key_list_text}"

    hidden_keys = tmp.metadata_hidden_wo_edit_perm
    if len(hidden_keys) > 0:
        has_edit_perm = not (not get_asset(user, asset_id, needs_edit_permission=True, db=db))
        if not has_edit_perm:
            hidden_key_list = [f"'{x}'" for x in hidden_keys]
            hidden_key_list = f"({','.join(hidden_key_list)})"
            protected_text += f" AND `key` NOT IN {hidden_key_list}"

    sql = f"""
        WITH a as (
            SELECT asset_metadata.*, assets.creator_id, assets.group_id
            FROM asset_metadata
            JOIN assets ON asset_metadata.asset_id = assets.id
            WHERE asset_id = %s{key_text}{protected_text}
        )
        SELECT SQL_CALC_FOUND_ROWS DISTINCT a.* FROM a
        LEFT JOIN asset_permissions ap ON a.asset_id = ap.asset_id OR a.group_id = ap.group_id
        WHERE {get_permissioning_string(user)}
        {order_by_clause}
        {limit_text}
        {offset_text}
        """
    args = (asset_id,)

    curr.execute(sql, args)
    res = curr.fetchall()

    total = 0
    if get_total:
        curr.execute("SELECT FOUND_ROWS()")
        total = curr.fetchone()['FOUND_ROWS()']

    return res, total


# Replace for user should be a user id
@needs_db
def save_asset_metadata(user: User, asset_id, key, value, needs_attention=False, replace_all=False, replace_for_user=None, db=None):
    curr = db.cursor()
    if replace_all or replace_for_user:
        sql = """
        DELETE FROM asset_metadata
        WHERE `key`=%s AND `asset_id`=%s
        """
        if not replace_all:
            sql += f" AND `user_id`='{db.escape_string(replace_for_user)}'"
        curr.execute(sql, (key, asset_id))

    sql = """
    INSERT INTO asset_metadata (`user_id`, `asset_id`, `key`, `value`, `needs_attention`)
    VALUES (%s, %s, %s, %s, %s)
    """
    user_id = user.user_id if user else None
    curr.execute(sql, (user_id, asset_id, key, value, needs_attention))
    return curr.lastrowid


"""

It sets gives the permissions using joint_asset_id to its recursive children.

Rules:

Every entry gives the creator access to the asset.

Public: an entry of 1 means that any user can view.

Can edit: Any matching user has edit access

Joint asset id: Set automatically here as it recurses.

Each email domain is given its own specific entry into the table.
    
Email domains: any user with that email address or domain can view.

Edit domains (not a column): any user with that email address or domain can edit and view.

**This function is not permissioned at the top level !!!**
(only call it when you know the user already has edit access to the asset with asset_id)

"""
@needs_db
def set_asset_permissions(user: User, asset_id, email_domains=[], edit_domains=[], public=False, can_edit=False, additive=False, email_on_share=False, asset_row={}, no_commit=False, db=None):

    curr = db.cursor()

    if not ALLOW_PUBLIC_UPLOAD:
        public = False

    # doing this so we can send emails to new permissions holders.
    existing_emails = []
    to_send_emails = []
    if email_on_share:
        if 'title' not in asset_row or 'author' not in asset_row:
            raise Exception("For email_on_share=True, you need to provide the title and author of the asset (asset_row={...}).")
        existing_perms = get_permissions(asset_id, no_joints=True, db=db, no_commit=True)
        existing_emails = [user.email] + [x['email_domain'] for x in existing_perms if x['email_domain']]

    # We'll be inserting rows for each email domain + one placeholder for public view if necessary
    # Remove all if editing, we'll add the new permissions afterward

    if not additive:
        # Note that this doesn't delete joint permissions. That is done with propagate.
        sql = """
            DELETE FROM asset_permissions
            WHERE `asset_id`=%s;
            """
        curr.execute(sql, (asset_id))

    # In reality, only public is needed; can edit doesn't do anything without another column. ?
    if public or can_edit:
        sql = """
        INSERT INTO asset_permissions (`asset_id`, `public`, `can_edit`)
        VALUES (%s, %s, %s)
        """
        curr.execute(sql, (asset_id, int(public), int(can_edit)))

    for email in email_domains:
        if email in ILLEGAL_SHARE_DOMAINS:
            continue
        if email_on_share and is_valid_email(email) and email not in existing_emails and email not in to_send_emails:
            to_send_emails.append(email)
        sql = """
            INSERT INTO asset_permissions (`asset_id`, `email_domain`)
            VALUES (%s, %s)
            """
        curr.execute(sql, (asset_id, email))

    for email in edit_domains:
        if email in ILLEGAL_SHARE_DOMAINS:
            continue
        if email_on_share and is_valid_email(email) and email not in existing_emails and email not in to_send_emails:
            to_send_emails.append(email)
        sql = """
            INSERT INTO asset_permissions (`asset_id`, `email_domain`, `can_edit`)
            VALUES (%s, %s, 1)
            """
        curr.execute(sql, (asset_id, email))

    propagate_joint_permissions(user, asset_id, no_commit=no_commit, db=db)
    if email_on_share and len(to_send_emails):
        from .email import send_email  # unfortunately have to avoid the circular import
        
        asset_title = asset_row['title']
        asset_author = asset_row['author']
        user_email = user.email
        asset_link = FRONTEND_URL + f"/assets/{asset_id}"

        email_body = f'Hello,<br><br>You\'ve just been shared {asset_title} by {asset_author} on Abbey. Check it out here: <a href="{asset_link}">{asset_link}</a>. The email of the user who sent you this is {user_email}.'
        subject = f"You've been added to {asset_title} on Abbey"

        send_email(to_send_emails, subject, email_body, user=user)


@needs_db
def propagate_joint_permissions(user: User, parent_asset_id, db=None):

    curr = db.cursor()

    def insert_permission(can_edit, public, email_domain, user_id, new_asset_id, new_joint_id):
        sql = """
        INSERT INTO asset_permissions (`can_edit`, `public`, `email_domain`, `user_id`, `asset_id`, `joint_asset_id`)
        VALUES (%s, %s, %s, %s, %s, %s)
        """
        curr.execute(sql, (can_edit, public, email_domain, user_id, new_asset_id, new_joint_id))

    # branch ids is for cycle detection
    def find_assets(current_asset_id, branch_ids):

        """

        ***
        Need to make sure that every permission the parent has, the child also has.
        But also need to make sure that every permission the child claims is from the parent, the parent has.
        And of course needs to actually add the new permissions to the parent.
        ***

        """

        curr_asset = get_asset(user, current_asset_id)

        sources = get_sources(user, current_asset_id, needs_edit_permission=True, ignore_parent_permissions=True, db=db)
        if not sources or not len(sources):
            return
                
        # Returns list of results, each of which contains both a parent (cols start with p_) and a child permission (cols start with c_).
        # Matching perms will match up. Perms that don't match up with anything (because some child has it but parent doesn't, or parent has it but no child does) will still show up, but corresponding child or parent cols will be all None (including id).
        sql = """
        WITH parent AS (
            SELECT 
                `id` AS p_id,
                `asset_id` AS p_asset_id,
                `can_edit` AS p_can_edit,
                `public` AS p_public,
                `email_domain` AS p_email_domain,
                `joint_asset_id` AS p_joint_asset_id,
                `user_id` AS p_user_id
            FROM asset_permissions
            WHERE `asset_id` = %s
        ),
        children AS (
            SELECT 
                `id` AS c_id,
                `asset_id` AS c_asset_id,
                `can_edit` AS c_can_edit,
                `public` AS c_public,
                `email_domain` AS c_email_domain,
                `joint_asset_id` AS c_joint_asset_id,
                `user_id` AS c_user_id
            FROM asset_permissions
            WHERE `asset_id` IN (
                SELECT value
                FROM asset_metadata
                WHERE `key` = 'retrieval_source' AND `asset_id` = %s
            ) AND `joint_asset_id` = %s
        )
        SELECT 
            p.p_id,
            p.p_asset_id,
            p.p_can_edit,
            p.p_public,
            p.p_email_domain,
            p.p_joint_asset_id,
            p.p_user_id,
            c.c_id,
            c.c_asset_id,
            c.c_can_edit,
            c.c_public,
            c.c_email_domain,
            c.c_joint_asset_id,
            c.c_user_id
        FROM parent p
        LEFT JOIN children c ON (
            COALESCE(p.p_can_edit, 0) = COALESCE(c.c_can_edit, 0)
            AND COALESCE(p.p_public, 0) = COALESCE(c.c_public, 0)
            AND COALESCE(p.p_email_domain, '') = COALESCE(c.c_email_domain, '')
            AND COALESCE(p.p_user_id, '') = COALESCE(c.c_user_id, '')
        )
        UNION
        SELECT 
            p.p_id,
            p.p_asset_id,
            p.p_can_edit,
            p.p_public,
            p.p_email_domain,
            p.p_joint_asset_id,
            p.p_user_id,
            c.c_id,
            c.c_asset_id,
            c.c_can_edit,
            c.c_public,
            c.c_email_domain,
            c.c_joint_asset_id,
            c.c_user_id
        FROM children c
        LEFT JOIN parent p ON (
            COALESCE(p.p_can_edit, 0) = COALESCE(c.c_can_edit, 0)
            AND COALESCE(p.p_public, 0) = COALESCE(c.c_public, 0)
            AND COALESCE(p.p_email_domain, '') = COALESCE(c.c_email_domain, '')
            AND COALESCE(p.p_user_id, '') = COALESCE(c.c_user_id, '')
        )

        """

        curr.execute(sql, (current_asset_id, current_asset_id, current_asset_id))
        perm_pairs = curr.fetchall()
        parent_creator = curr_asset['creator_id'] if curr_asset['creator_id'] else None

        perms_to_children = {}
        creator_perm_key = json.dumps({'can_edit': 1, 'public': 0, 'email_domain': None, 'user_id': parent_creator}, sort_keys=True)
        perms_to_children[creator_perm_key] = []

        for perm in perm_pairs:
            # Is there a parent permission missing?
            # Then remove it.
            if not perm['p_id']:
                # make sure there's no implicit creator perm match
                if parent_creator is None or perm['c_user_id'] != parent_creator:
                    sql = """
                    DELETE FROM asset_permissions
                    WHERE `id`=%s
                    """
                    curr.execute(sql, (perm['c_id']))
                else:
                    # But if there is, record it so we don't add it again.
                    perms_to_children[creator_perm_key].append(perm['c_asset_id'])
                    continue  # it's handled separately.
            
            key = {'can_edit': perm['p_can_edit'], 'public': perm['p_public'], 'email_domain': perm['p_email_domain'], 'user_id': perm['p_user_id']}
            key = json.dumps(key, sort_keys=True)

            # If there's no child, that means no children matched
            if not perm['c_id']:
                perms_to_children[key] = []
            else:
                # But if there was a match, we record that the child had this permission
                if key in perms_to_children:
                    perms_to_children[key].append(perm['c_asset_id'])
                else:
                    perms_to_children[key] = [perm['c_asset_id']]
        
        # Now we check to make sure all the children have their proper permissions            
        for source in sources:
            source_id = source['id']
            if source_id in branch_ids:
                continue

            for perm in perms_to_children:
                children_that_have = perms_to_children[perm]
                if source_id not in children_that_have:
                    if source['creator_id'] == parent_creator and perm == creator_perm_key:
                        continue  # unnecessary since the implicit parent permission is included.
                    perm_json = json.loads(perm)
                    insert_permission(perm_json['can_edit'], perm_json['public'], perm_json['email_domain'], perm_json['user_id'], source_id, current_asset_id)

            find_assets(source_id, [*branch_ids, source_id])

    find_assets(parent_asset_id, [parent_asset_id])


# Not permissioned!
# Unlike "get asset resources", returns only 1 corresponding to the name of the resource.
# Note also that get_asset_resources might not return all asset resources, since it usually includes only "main" files.  
@needs_db
def get_asset_resource(asset_id, name, db=None):
    sql = """
    SELECT * FROM asset_resources
    WHERE `asset_id`=%s AND `name`=%s
    """
    curr = db.cursor()
    curr.execute(sql, (asset_id, name))
    res = curr.fetchone()
    return res


# Not permissioned!
@needs_db
def add_asset_resource(asset_id, name, from_loc, path, title, db=None):
    sql = """
    INSERT INTO asset_resources (`asset_id`, `name`, `from`, `path`, `title`)
    VALUES (%s, %s, %s, %s, %s);
    """
    curr = db.cursor()
    curr.execute(sql, (asset_id, name, from_loc, path, title))
    lrid = curr.lastrowid
    return lrid


@needs_db
def replace_asset_resource(asset_id, name, from_loc, path, title, no_commit=False, db=None):
    curr = db.cursor()
    sql = f"""
    SELECT * FROM asset_resources
    WHERE `asset_id` = %s AND `name` = %s
    """
    curr.execute(sql, (asset_id, name))
    results = curr.fetchall()
    if results and len(results):
        delete_resources(results)

    sql = f"""
    DELETE FROM asset_resources
    WHERE `asset_id` = %s AND `name` = %s
    """
    curr.execute(sql, (asset_id, name))

    return add_asset_resource(asset_id, name, from_loc, path, title, no_commit=no_commit, db=db)


@needs_db
def add_resource_from_text(asset_id, res_name, text, replace=False, db=None):
    temp_file = tempfile.NamedTemporaryFile(mode='w+', delete=False)
    temp_file.write(text)
    temp_file.close()
    path, from_val = upload_asset_file(asset_id, temp_file.name, 'txt')
    os.remove(temp_file.name)

    if replace:
        assoc_file_id = replace_asset_resource(asset_id, res_name, from_val, path, None, db=db)
    else:
        assoc_file_id = add_asset_resource(asset_id, res_name, from_val, path, None, db=db)

    return assoc_file_id



# NOT PERMISSIONED
@needs_db
def delete_asset(asset_row, db=None):
    
    asset_id = asset_row['id']
    curr = db.cursor()

    # Remove all asset resources
    sql = """
    SELECT * FROM asset_resources
    WHERE `asset_id` = %s
    """
    curr.execute(sql, (asset_id,))
    results = curr.fetchall()
    delete_resources(results)

    # Delete asset resources (including on AWS)
    sql = """
    DELETE FROM `asset_resources`
    WHERE `asset_id` = %s
    """
    curr.execute(sql, (asset_id,))

    # Delete metadata
    sql = """
    DELETE FROM `asset_metadata`
    WHERE `asset_id` = %s
    """
    curr.execute(sql, (asset_id,))
    
    # Delete asset manifest rowR
    # Delete asset permissions

    sql = """
    DELETE FROM `asset_permissions`
    WHERE `asset_id` = %s OR `joint_asset_id` = %s
    """
    curr.execute(sql, (asset_id, asset_id))

    # Delete asset retrieval storage (and from AWS)
    sql = """
    SELECT * FROM asset_retrieval_storage
    WHERE `asset_id` = %s
    """
    curr.execute(sql, (asset_id,))
    results = curr.fetchall()
    delete_resources(results)

    sql = """
    DELETE FROM `asset_retrieval_storage`
    WHERE `asset_id` = %s
    """
    curr.execute(sql, (asset_id,))
    
    # NOTE: jobs resources are also attached to asset, so don't need to separately delete
    # However, we do not need to get rid of associated jobs storage
    
    sql = """
    DELETE FROM jobs_storage
    WHERE `job_id` IN (
        SELECT id FROM jobs
        WHERE `asset_id` = %s 
    )
    """
    curr.execute(sql, (asset_id,))

    sql = """
    DELETE FROM `jobs`
    WHERE `asset_id` = %s
    """
    curr.execute(sql, (asset_id,))

    sql = """
    DELETE FROM `assets`
    WHERE `id` = %s
    """
    curr.execute(sql, (asset_id,))

    sql = """
    DELETE FROM `asset_tags`
    WHERE `asset_id` = %s
    """
    curr.execute(sql, (asset_id,))

    # Delete stored media
    sql = """
    SELECT * FROM media_data
    WHERE `asset_id` = %s
    """
    curr.execute(sql, (asset_id,))
    results = curr.fetchall()
    delete_resources(results)

    sql = """
    DELETE FROM `media_data`
    WHERE `asset_id` = %s
    """
    curr.execute(sql, (asset_id,))

    # Notifications
    sql = """
    DELETE FROM `notifications`
    WHERE `asset_id` = %s
    """
    curr.execute(sql, (asset_id,))

    from .templates.template import Template
    from .templates.templates import get_template_by_code
    tmp: Template = get_template_by_code(asset_row['template'])

    # For any template specific cleanup
    tmp.delete(curr, asset_row)


# NOTE: DOES NOT DO TEMPLATE SPECIFIC UPLOAD
# NOTE: DOES NOT ADD PERMISSIONS
# Returns False, "reason" or True, asset_id
@needs_db
def upload_asset(user: User, asset_id, title, llm_description, preview_desc, template, author, is_editing, group_id=None, db=None):
    curr = db.cursor()
    # This means we're editing rather than just uploading
    if is_editing:
        # Update asset in asset manifest

        # This will ensure edit permissioning
        edited_asset = get_asset(user, asset_id, needs_edit_permission=True, db=db)

        if not edited_asset:
            return False, "Can't find asset to edit"
        
        creator = edited_asset['creator_id'] # creator doesn't change if a user w/ edit perms edits an asset

        sql = """
        UPDATE assets
        SET creator_id = %s, 
            title = %s, 
            lm_desc = %s, 
            preview_desc = %s, 
            template = %s, 
            author = %s,
            group_id = %s
        WHERE id = %s;
        """
        curr.execute(sql, (creator, title, llm_description, preview_desc, template, author, group_id, asset_id))
    else:
        sql = """
        INSERT INTO assets (`creator_id`, `title`, `lm_desc`, `preview_desc`, `template`, `author`, `group_id`)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        """
    
        curr.execute(sql, (user.user_id, title, llm_description, preview_desc, template, author, group_id))
        asset_id = curr.lastrowid

    return True, asset_id


# Wrapper around getting one asset
# It's permissioned
# If you must pass in the user token manually, you can
# NOTE: Might be best to move this elsewhere
@needs_db
def get_asset(user: User, asset_id, token=None, needs_edit_permission=False, append_can_edit=False, db=None):

    if token and not user:
        # Check for obviously invalid token
        # Could happen where the frontend accidetnally makes token "null" or "undefined" or something
        if len(token) > 10:
            user = User(token)
    perm_string = get_permissioning_string(user, edit_permission=needs_edit_permission, db=db)

    extra_columns = ""
    if append_can_edit:
        perm_edit_string = get_permissioning_string(user, edit_permission=True, db=db)
        extra_columns = f", MAX(CASE WHEN ({perm_edit_string}) THEN 1 ELSE 0 END) AS can_edit" if append_can_edit else ""

    sql = f"""
    WITH a as (SELECT * FROM assets
    WHERE id = %s)
    SELECT a.*{extra_columns} FROM a
    LEFT JOIN asset_permissions ap ON a.id = ap.asset_id OR a.group_id = ap.group_id
    WHERE {perm_string}
    GROUP BY a.id
    """

    curr = db.cursor()
    curr.execute(sql, (asset_id,))
    res = curr.fetchone()

    return res

# Like get_asset, except for getting assets in bulk (will return in same order as given).
# Unlike get_asset, doesn't return a can_edit key.
@needs_db
def get_assets(user: User, asset_ids, token=None, needs_edit_permission=False, db=None):

    if not asset_ids or not len(asset_ids):
        return []

    if token and not user:
        # Check for obviously invalid token
        # Could happen where the frontend accidentally makes token "null" or "undefined" or something
        if len(token) > 10:
            user = User(token)
    perm_string = get_permissioning_string(user, edit_permission=needs_edit_permission, db=db)

    asset_id_list = "(" + ",".join([str(x) for x in asset_ids]) + ")"

    sql = f"""
    WITH a AS (
        SELECT * FROM assets
        WHERE id IN {asset_id_list}
    )
    SELECT DISTINCT a.* 
    FROM a
    LEFT JOIN asset_permissions ap ON a.id = ap.asset_id OR a.group_id = ap.group_id
    WHERE {perm_string}
    ORDER BY FIELD(a.id, {','.join([str(x) for x in asset_ids])})
    """

    curr = db.cursor()
    curr.execute(sql)
    res = curr.fetchall()

    return res


# Unpermissioned
# Gets all assets in a group (for removing/adding group ids)
@needs_db
def get_assets_in_group(group_id, db=None):

    sql = """
    SELECT * FROM assets
    WHERE `group_id`=%s
    """
    curr = db.cursor()
    curr.execute(sql, (group_id))
    res = curr.fetchall()

    return res


def get_retriever_cache_name(retriever_type_name, asset_id):
    return f"{retriever_type_name}_{asset_id}"


# Returns None if failed
# retriever_type_name can be used to give an asset new/multiple retrievers (ex., when you don't need embeddings)
# Note: force_create and cache were from an era in which retrievers were cached in memory; currently, they are not.
@needs_db
def get_or_create_retriever(user: User, asset_row, asset_resources, retriever_type_name="retriever", retriever_options={}, force_create=False, no_cache=False, db=None):
    
    retriever_name = get_retriever_cache_name(retriever_type_name, asset_row['id']) 
    # LOCK - using database lock
    # This is to ensure multiple threads / programs do not run this code in parallel
    # If they do, things might break!

    # There's a paired release at the bottom of the function
    @with_lock(retriever_name, db=db)
    def do_with_lock():
        curr = db.cursor()

        # There are read-after-write issues with bursted requests - this is a fix
        # HOWEVER: IF DEPLOYED, THIS ISN'T ALLOWED DUE TO RDS SETTINGS
        # This setting needs to be set in RDS itself

        # It never undoes itself, so technically unnecessary after the first time
        if DB_TYPE == 'local':
            curr.execute("SET GLOBAL TRANSACTION ISOLATION LEVEL READ COMMITTED;")

        try:
            retriever = Retriever(user, asset_resources, **retriever_options)
        except NoCreateError:  # probably: no_create was signaled, but a creation was necessary. 
            retriever = None

        return retriever

    return do_with_lock()


@needs_db
def get_asset_resources(user, asset_row, exclude=[], db=None):
    from .templates.template import Template
    from .templates.templates import get_template_by_code
    temp: Template = get_template_by_code(asset_row['template'])
    asset_resources = temp.get_asset_resources(user, asset_row['id'], exclude=exclude, db=db, no_commit=True)
    return asset_resources


@needs_db
def make_retriever(user, asset_row, retriever_type_name="retriever", retriever_options={}, force_create=False, no_cache=False, job_id=None, except_text=None, exclude=[], db=None):
    asset_resources = get_asset_resources(user, asset_row, exclude=exclude)
    ret = get_or_create_retriever(user, asset_row, asset_resources, retriever_type_name=retriever_type_name, retriever_options=retriever_options, force_create=force_create, no_cache=no_cache, db=db)
    if except_text and ret is None:
        raise Exception(except_text)
    
    return ret


def make_retriever_job(user_obj, job_id, *args, **kwargs):

    db = get_db(new_connection=True)

    user: User = SynthUser(user_obj)

    @job_error_wrapper(job_id)
    def do_job():
        # In a job, don't have access to the cache.
        ret = make_retriever(user, *args, db=db, **kwargs)

    do_job()

    complete_job(job_id, db=db)


@needs_db
def save_chat(user: User, asset_row, context, db=None):
    user_id = user.user_id
    sql = """
    DELETE FROM asset_metadata
    WHERE `user_id`=%s
    AND `key`=%s
    AND `asset_id`=%s
    """

    curr = db.cursor()
    curr.execute(sql, (user_id, CHAT_CONTEXT, asset_row['id']))

    sql = """
    INSERT INTO asset_metadata (`user_id`, `asset_id`, `key`, `value`)
    VALUES (%s, %s, %s, %s)
    """

    curr.execute(sql, (user_id, asset_row['id'], CHAT_CONTEXT, json.dumps(context)))

    db.commit()

    # Return that which was saved
    return context


@needs_db
def mark_asset_title_as_updated(user: User, asset_id, db=None):
    sql = """
        INSERT INTO asset_metadata (`asset_id`, `key`, `value`, `user_id`)
        VALUES (%s, %s, %s, %s)
    """
    curr = db.cursor()
    curr.execute(sql, (asset_id, HAS_EDITED_ASSET_TITLE, 1, user.user_id if user else None))


@needs_db
def mark_asset_desc_as_updated(user: User, asset_id, db=None):
    sql = """
        INSERT INTO asset_metadata (`asset_id`, `key`, `value`, `user_id`)
        VALUES (%s, %s, %s, %s)
    """
    curr = db.cursor()
    curr.execute(sql, (asset_id, HAS_EDITED_ASSET_DESC, 1, user.user_id if user else None))



# NOTE: not permissioned
@needs_db
def has_asset_title_been_updated(asset_id, db=None):
    sql = """
        SELECT * FROM asset_metadata
        WHERE `asset_id`=%s AND `key`=%s AND `value`=1
    """

    curr = db.cursor()
    curr.execute(sql, (asset_id, HAS_EDITED_ASSET_TITLE,))
    lst = curr.fetchall()
    return not (not (lst and len(lst) > 0))  # stupid


# NOTE: not permissioned
@needs_db
def has_asset_desc_been_updated(asset_id, db=None):

    # Escape hatch for assets in groups: these are always considered edited.
    curr = db.cursor()
    sql = """SELECT * FROM assets WHERE `id`=%s AND `group_id` IS NULL"""
    curr.execute(sql, (asset_id,))
    res = curr.fetchone()
    if not res:
        return False
    
    sql = """
        SELECT * FROM asset_metadata
        WHERE `asset_id`=%s AND `key`=%s AND `value`=1
    """
    
    curr.execute(sql, (asset_id, HAS_EDITED_ASSET_DESC,))
    lst = curr.fetchall()
    return not (not (lst and len(lst) > 0))  # stupid


# NOT permissioned, but ADDS JOINT PERMISSIONS TOO (which are permissioned).
@needs_db
def set_sources(user: User, asset_id, new_resource_ids, additive=False, db=None):
    curr = db.cursor()

    if not new_resource_ids:
        new_resource_ids = []

    # Delete all previous retrieval_sources and joint permissions
    if not additive:

        sources = get_sources(user, asset_id, needs_edit_permission=True, db=db, no_commit=True)
        source_ids = [x['id'] for x in sources]
        removed_source_list = [x for x in source_ids if x not in new_resource_ids]
        new_resource_ids = [x for x in new_resource_ids if x not in source_ids]

        if len(removed_source_list) > 0:
            source_list = ", ".join([f"{x}" for x in removed_source_list])
            sql = f"""
            DELETE FROM asset_permissions
            WHERE `joint_asset_id`=%s
            AND `asset_id` IN ({source_list})
            """
            curr.execute(sql, (asset_id,))
            for x in removed_source_list:
                propagate_joint_permissions(user, x, db=db, no_commit=True)

            sql = f"""
            DELETE FROM asset_metadata
            WHERE `asset_id`=%s AND `key`=%s AND `value` IN ({source_list});
            """
            curr.execute(sql, (asset_id, RETRIEVAL_SOURCE))

    if len(new_resource_ids) > 0:    
        escapes = ", ".join(["(%s, %s, %s)" for _ in range(len(new_resource_ids))])
        # Add them all back.
        sql = f"""
        INSERT INTO asset_metadata (`asset_id`, `key`, `value`)
        VALUES {escapes}
        """

        args = []
        for rid in new_resource_ids:
            args.extend([asset_id, RETRIEVAL_SOURCE, rid])
        curr.execute(sql, args)
        propagate_joint_permissions(user, asset_id, db=db, no_commit=True)
    # auto commits with needs db


"""
Returns a list of rows from assets, where each asset is a retrieval source
    of the asset specified with asset_id.
    in_order=True uses a book ordering if available.

ignore_parent_permissions -> does the calling user need perms on the parent, or just the children? (useful for propagate joint perms when the caller's perms are getting removed.)
"""
@needs_db
def get_sources(user: User, asset_id, needs_edit_permission=False, ordered=False, ignore_parent_permissions=False, db=None):
    if not asset_id:
        return []

    if not ignore_parent_permissions:
        asset = get_asset(user, asset_id, db=db)
        if not asset:
            return []
    
    order_by_clause = ""
    if ordered:
        order = get_book_order(asset_id, db=db)
        if order is not None:
            str_order = ', '.join([str(x) for x in order['ids'][::-1]])
            # reversed bc not in the list is zero and we want them last
            # the first item in the unflipped list now has the highest index thus coming first on a DESC
            order_by_clause = f"ORDER BY FIELD(id, {str_order}) DESC"

    permissions_part = f"""LEFT JOIN asset_permissions ap ON a.id = ap.asset_id OR a.group_id = ap.group_id
        WHERE {get_permissioning_string(user, edit_permission=needs_edit_permission)}"""

    sql = f"""
        WITH a as (
            SELECT *
            FROM assets
            WHERE id IN (
                SELECT `value`
                FROM asset_metadata
                WHERE `key`='{RETRIEVAL_SOURCE}'
                  AND `asset_id`=%s
            )
        )
        SELECT a.* FROM a
        {permissions_part}
        GROUP BY a.id
        {order_by_clause}
    """
    curr = db.cursor()
    curr.execute(sql, (asset_id,))

    results = curr.fetchall()

    return results

# Returns (results, total) (total = 0 if ignore_total=True)
# IF YOU NEED TOTAL (get_total=True) PASS exclusive=True TO KEEP TOTAL VALUE FROM GETTING CORRUPTED
@needs_db
def search_assets(
                user: User,
                search="",  # Broken up into search terms and scored
                limit=1000,
                offset=0,
                only_templates: list=None,  # list of codes. If none, includes all.
                folders_first=False,  # Should all the folders that are returned go first?
                recent_activity=False,  # Only include recent activity, defined inside?
                sub_manifest=None,  # Only search the retrieval sources of some asset?
                my_uploads=False,  # Only get assets where the creator id matches the user
                isolated=False,  # If true, search will ignore public permissions flags
                alphabetical=False,  # Return the results in alphabetical order by title
                group_ids: list=None,  # Asset's group id must be in this list, if not None.
                include_groups=False,  # Include assets that are part of a group (otherwise will ignore them)
                include_group_ids: list=[],  # Include assets of these groups in the search, along with non-group assets, and only these groups
                groups_only=False,  # Include only assets that are part of a group. Cannot be used with above group options.
                include_purchased_groups=True,  # Include assets from groups that the user purchased
                ignore_total=False,
                filter_tags_on_groups={},  # dict of group id -> dict like {'tag': false} - note we include those tags without an entry.
                    # Also: special tag "Others" (true by default) decides whether we include untagged.
                needs_edit_permission=False,
                exclude_ids: list=[],  # list of asset ids to exclude from search
                db=None
            ):

    search = db.escape_string(str(search)) if search else ""
    limit = str(int(limit))
    offset = str(int(offset))
    if not user and recent_activity:
        raise UserIsNoneError("Cannot get recent activity without a user")

    only_templates_string = "" if not only_templates else "AND (" + " OR ".join([f"a.template = '{db.escape_string(x)}'" for x in only_templates]) + ")"

    order_by_clause = "time_uploaded DESC"
    if recent_activity:
        order_by_clause = "timestamp DESC"
    elif alphabetical:
        order_by_clause = "title ASC"

    if folders_first and int(folders_first) != 0:
        order_by_clause = f"""
        CASE
            WHEN template = 'folder' THEN 1 ELSE 2
        END, {order_by_clause}
        """
    if sub_manifest:
        order = get_book_order(sub_manifest)
        if order is not None:
            str_order = ', '.join([str(x) for x in order['ids'][::-1]])
            # reversed bc not in the list is zero and we want them last
            # the first item in the unflipped list now has the highest index thus coming first on a DESC
            order_by_clause = f"FIELD(id, {str_order}) DESC"

    sub_manifest_clause = ""
    if sub_manifest:
        sub_manifest_clause = f"""
            AND assets.id IN
                (
                    SELECT `value`
                    FROM asset_metadata
                    WHERE `key`='{RETRIEVAL_SOURCE}'
                    AND `asset_id`={db.escape_string(str(sub_manifest))}
                )
            """
    elif group_ids and len(group_ids) > 0:
        sub_manifest_clause = f"AND assets.group_id IN ({','.join([db.escape_string(str(x)) for x in group_ids])})"
    elif include_group_ids and len(include_group_ids) > 0: 
        sub_manifest_clause = f"AND (assets.group_id IS NULL OR assets.group_id IN ({','.join([db.escape_string(str(x)) for x in include_group_ids])}))"
    elif groups_only:
        sub_manifest_clause = "AND assets.group_id IS NOT NULL"
    elif not recent_activity and not include_groups and not include_purchased_groups:
        sub_manifest_clause = "AND assets.group_id IS NULL"
    
    if exclude_ids and len(exclude_ids) > 0:
        exclusion_list_str = ",".join([db.escape_string(str(x)) for x in exclude_ids])
        sub_manifest_clause += f" AND (assets.id NOT IN ({exclusion_list_str}))"

    tagging_join = ""
    tagging_where = ""
    if filter_tags_on_groups and len(filter_tags_on_groups) > 0:
        pairs = []
        for group in filter_tags_on_groups:
            not_tag_list = [f"'{db.escape_string(k)}'" for k, x in filter_tags_on_groups[group].items() if not x]
            if len(not_tag_list):
                not_tag_list_string = ",".join(not_tag_list)
                pairs.append((not_tag_list_string, group))
        if len(pairs):
            tagging_join = "LEFT JOIN asset_tags atag ON atag.asset_id = a.id"
            tagging_where = ""
            for pair in pairs:
                include_others = ""
                group_obj = filter_tags_on_groups[pair[1]]
                if 'Others' not in group_obj or group_obj['Others']:  # Some special behavior for a special tag
                    include_others = "atag.value IS NULL OR "
                
                tagging_where += f" AND ({include_others}atag.value NOT IN ({pair[0]}) OR a.group_id IS NULL OR a.group_id != {pair[1]})"
            tagging_where = f"AND (1=1 {tagging_where})"

    search_clause = f"SELECT *, 1 AS score FROM assets WHERE 1=1 {sub_manifest_clause}"
    if len(search) > 0:

        search_query = db.escape_string(search)
        order_by_clause = "score DESC, " + order_by_clause

        search_clause = f"""
        SELECT 
            assets.*,
            (
                (MATCH(assets.title) AGAINST ('"{search_query}"' IN BOOLEAN MODE) * 100) +
                MATCH(assets.title) AGAINST ('{search_query}' IN NATURAL LANGUAGE MODE) * 4 +
                MATCH(assets.preview_desc) AGAINST ('{search_query}' IN NATURAL LANGUAGE MODE) * 1 +
                MATCH(assets.author) AGAINST ('{search_query}' IN NATURAL LANGUAGE MODE) * .5
            ) AS score
        FROM assets
        WHERE (MATCH(assets.title, assets.preview_desc, assets.author) AGAINST ('{search_query}' IN NATURAL LANGUAGE MODE)
            OR assets.title LIKE '{search_query}%')
        {sub_manifest_clause}
        GROUP BY assets.id
        ORDER BY {order_by_clause}
        """
    
    # Factored this out so we could do a join for groups when appropriate.
    def get_main_search_query(use_calc, ap_join_on, redefine=False, purchased_groups=False):
        purchased_groups_join = "LEFT JOIN asset_groups ag ON ag.id = a.group_id AND ag.product_id IS NOT NULL" if purchased_groups else ""
        return f"""
        SELECT {"SQL_CALC_FOUND_ROWS" if use_calc else ""} a.*,
            MAX(CASE
                WHEN ({get_permissioning_string(user, edit_permission=True)})
                THEN 1
                ELSE 0
            END) AS has_edit_permission
        FROM a
        LEFT JOIN asset_permissions ap ON {ap_join_on}
        {tagging_join}
        {purchased_groups_join}
        WHERE ({get_permissioning_string(user, user_uploads_only=my_uploads, get_public=(not isolated), edit_permission=needs_edit_permission)})
        {"AND ag.product_id IS NOT NULL" if purchased_groups_join else ""}
        {only_templates_string}
        {tagging_where}
        GROUP BY a.id
        """
    
    # Same goes here, though it's a modified query.
    def get_ra_search_query(use_calc, ap_join_on, redefine=True, purchased_groups=False):
        purchased_groups_join = "LEFT JOIN asset_groups ag ON ag.id = a.group_id AND ag.product_id IS NOT NULL" if purchased_groups else ""
        sql = ""
        if redefine:
            sql += f"""
            recent_activity as (
                SELECT ua.* FROM user_activity ua
                WHERE ua.user_id = '{user.user_id}' AND ua.type = 'view' AND ua.timestamp > (NOW() - INTERVAL 2 WEEK)
            ),
            a as (
                SELECT ass.*, MAX(ra.timestamp) as timestamp
                FROM ass
                INNER JOIN recent_activity ra ON ass.id = ra.asset_id
                GROUP BY ass.id
            )"""
        
        sql += f"""
        SELECT {"SQL_CALC_FOUND_ROWS" if use_calc else ""} DISTINCT a.*,
            MAX(
            CASE
                WHEN ({get_permissioning_string(user, edit_permission=True)})
                THEN 1
                ELSE 0
            END) AS has_edit_permission
        FROM a
        LEFT JOIN asset_permissions ap ON {ap_join_on}
        {tagging_join}
        {purchased_groups_join}
        WHERE ({get_permissioning_string(user, user_uploads_only=my_uploads, edit_permission=needs_edit_permission)})
        {"AND ag.product_id IS NOT NULL" if purchased_groups_join else ""}
        {only_templates_string}
        {tagging_where}
        GROUP BY id
        """

        return sql

    # The idea here is that the asset permissions JOIN is too slow with an OR
    # So instead, we need a union.
    # In order to do the union, parts of the query need to be duplicated, hence the functions - one for each end of the query.

    """
    PARTS OF THE QUERY

    PREAMBLE - Getting the right WITH tables (WITH a AS {search_clause}) or similar, different depending on stuff)
    BODY - returned via the correct sql function. Ends with a group by asset id.
    UNION (optional) - optional, included if we need groups.
    BODY (optional) - same as above, modified for use after union.
    ENDING - order, limit, offset

    """

    # DO PREAMBLE
    preamble = ""
    if recent_activity:
        preamble = f"""WITH ass as (
            {search_clause}
        ),"""
    else:
        preamble = f"""
        WITH a as (
            {search_clause}
        )
        """

    # GET BODY
        
    # There are different queries for recent activity / regular, so this chooses the appropriate
    correct_sql_fn = get_ra_search_query if recent_activity else get_main_search_query
    
    # If we need group info, this sets it up
    group_sql = ""
    regular_sql = ""

    need_general_groups = groups_only or include_groups or (group_ids and len(group_ids)) or (include_group_ids and len(include_group_ids))
    if include_purchased_groups or need_general_groups:
        group_sql = correct_sql_fn(not ignore_total, "a.group_id = ap.group_id", purchased_groups=(include_purchased_groups and not need_general_groups))

    if not group_ids or not len(group_ids):
        regular_sql = correct_sql_fn(not ignore_total and not group_sql, "a.id = ap.asset_id", redefine=(not group_sql))

    sql = ""  # Will become the actual sql run.
    
    if group_sql and regular_sql:
        # group sql is first because it has the CALC when appropriate.
        sql = f"""
        {preamble}
        {group_sql}
        UNION
        """
        if recent_activity and not group_sql:
            sql += f"""WITH {regular_sql}"""  # need to include the with because no preamble.
        else:
            sql += regular_sql
    elif group_sql:
        sql = f"""
        {preamble}
        {group_sql}"""
    else:
        sql = f"""
        {preamble}
        {regular_sql}"""

    # Now do the ending.
    sql += f"""
    ORDER BY {order_by_clause}
    LIMIT {limit}
    OFFSET {offset}
    """
    curr = db.cursor()
    curr.execute(sql)
    res = curr.fetchall()  # list of dictionaries
    total = 0
    if not ignore_total:  # and this is why we use the exclusive connection ... need to be the only one on it here.
        curr.execute("SELECT FOUND_ROWS()")
        total = curr.fetchone()['FOUND_ROWS()']
    return res, total


def suggest_questions(user: User, asset_row, context, detached=False, n=3):

    # Context contains the converation
    # We need to take the last question, make it the primary one, and then call the ones before, the context.
    split_context = []
    real_q = ""
    if len(context):
        real_q = context[-1]['user']
        split_context = context[:-1]

    # Same code used in /chat (1/25/24)
    split_context_strs = [x['user']+ " AI: " + x['ai'] for x in split_context]  # combine both user and ai text for embedding

    system_prompt = ""
    if not detached:
        retriever: Retriever = make_retriever(user, asset_row)
        if len(split_context_strs):
            retrieval_response = retriever.query(real_q, max_results=MAX_CHAT_RETRIEVER_RESULTS, context=split_context_strs)
        else:
            retrieval_response = retriever.random(MAX_CHAT_RETRIEVER_RESULTS)

        # note that context isn't being used in the prompt yet.
        system_prompt = get_suggest_questions_system_prompt(n, retrieval_response, real_q, split_context)
    else:
        system_prompt = get_suggest_questions_system_prompt_detached(n, real_q)

    llm_question = get_suggest_questions_prompt(n, real_q)

    # The current fast lm doens't support make_json, but in case it changes.
    lm: LM = LM_PROVIDERS[FAST_CHAT_MODEL]
    text = lm.run(llm_question, system_prompt=system_prompt, make_json=True)
    total_json = json.loads(text)  # if it throws a value error, it throws a value error!
    questions = total_json['questions']  # if it throws a key error, it throws a key error!
    return questions


# Returns dict with form: {"id": [123, 456, ...]}
@needs_db
def get_book_order(asset_id, db=None):
    sql = f"""
    SELECT `value` FROM asset_metadata
    WHERE asset_id=%s AND `key`='{BOOK_ORDER}'
    ORDER BY `time_uploaded` DESC
    """
    curr = db.cursor()
    curr.execute(sql, (asset_id))
    order = curr.fetchone()
    if not order:
        return None
    
    val = json.loads(order['value'])
    return val


# Ex: order=[923, 420, 124]
@needs_db
def set_book_order(asset_id, order, db=None):
    my_json = json.dumps({'ids': order})
    sql = """
    INSERT INTO asset_metadata (`key`, `asset_id`, `value`)
    VALUES (%s, %s, %s)
    """
    curr = db.cursor()
    curr.execute(sql, (BOOK_ORDER, asset_id, my_json))


@needs_special_db(consistent_conn=True)
def start_summary_apply_job(user: User, asset_row, db=None):
    assert(user)

    retriever_options = {}
    retriever_type_name = 'retriever'

    applier: Retriever = make_retriever(user, asset_row, retriever_type_name=retriever_type_name, retriever_options=retriever_options, db=db)

    if not applier:
        raise Exception("Couldn't make applier in start summary apply job")

    instructions = get_summary_apply_instructions()
    meta = json.dumps({'instructions': instructions})

    job_id = start_job(instructions, meta, asset_row['id'], SUMMARY_APPLY_JOB, new_conn=False, user_id=user.user_id, db=db)
    
    task_apply.apply_async(args=[pickle.dumps(applier), instructions], kwargs={'job_id': job_id, 'combine_chunks': 5, 'new_conn':True})

    return job_id


@needs_special_db(consistent_conn=True)
def start_summary_reduce_job(user: User, asset_row, apply_job_id, db=None):
    assert(user)

    reducer: Reducer = Reducer(asset_row['id'], apply_job_id)

    metadata = {'kind': 'pairwise', 'job_id': apply_job_id}
    metadata['instructions'] = get_summary_reduce_instructions()

    reduce_job_id = start_job(metadata['instructions'], metadata, asset_row['id'], SUMMARY_PAIRWISE_JOB, user_id=user.user_id, db=db)

    func = reducer.pairwise
    args = [reduce_job_id, metadata['instructions']]
    kwargs = {
        'clean_up_source': True
    }

    task_general.apply_async(args=[pickle.dumps(func), *args], kwargs=kwargs)

    return reduce_job_id
