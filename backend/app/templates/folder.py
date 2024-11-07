from ..storage_interface import delete_resources
from ..configs.user_config import MAX_PDF_PAGES
from ..exceptions import PdfTooLongError
from ..db import needs_db
from ..utils import get_extension_from_path, remove_ext, is_valid_email
from ..asset_actions import upload_asset, set_sources

from ..auth import get_permissioning_string, User, token_required, token_optional
from ..db import get_db
from ..template_response import MyResponse
import os
from flask import (
    request,
    request,
    send_file,
    Blueprint
)
from flask_cors import cross_origin
from ..asset_actions import get_asset
from ..configs.str_constants import *
from .template import Template
import json
import tempfile
import shutil
import sys
from ..prompts.prompt_fragments import get_basic_ai_identity, get_citation_prompt



bp = Blueprint('folder', __name__, url_prefix="/folder")

"""

Gets user's folders that don't belong to another folder.

Can isolate groups, but has no other functionality, making it unsuitable for many AssetsTables.

**USES A BESPOKE PERMISSIONING STRING FOR PERFORMANCE**

"""
@bp.route('/top-level-manifest', methods=('GET',))
@cross_origin()
@token_required
def manifest(user: User):
    db = get_db()

    limit = request.args.get('limit')
    if not limit or int(limit) > 100:  # max limit is 100
        limit = 10
    else:
        limit = int(limit)

    escaped_email = user.email
    user_id = user.user_id
    email_domain = db.escape_string(escaped_email.split("@")[1]) if is_valid_email else "localhost"

    sql = f"""
    WITH ass AS (
        SELECT a.*,
            MAX(
                CASE
                    WHEN (
                        a.creator_id = '{user.user_id}' OR a.id IN (
                            SELECT asset_id
                            FROM asset_permissions
                            WHERE (email_domain = '{escaped_email}' OR email_domain = '{email_domain}' OR user_id LIKE '{user_id}') AND can_edit = 1
                        )
                    )
                    THEN 1
                    ELSE 0
                END
            ) AS has_edit_permission
        FROM assets a
        WHERE a.template = 'folder' AND (
            a.creator_id = '{user.user_id}'
            OR a.id IN (
                SELECT asset_id
                FROM asset_permissions
                WHERE email_domain = '{escaped_email}' OR email_domain = '{email_domain}' OR user_id = '{user_id}'
            )
        )
        GROUP BY a.id
    )
    SELECT ass.*
    FROM ass
    WHERE NOT EXISTS (
        SELECT 1
        FROM asset_metadata am
        WHERE ass.id = am.value AND am.key = '{RETRIEVAL_SOURCE}' AND am.asset_id IN (SELECT id FROM ass)
    )
    ORDER BY `title` ASC
    LIMIT {limit}
    """
    curr = db.cursor()
    curr.execute(sql)
    res = curr.fetchall()
    return MyResponse(True, {'results': res}).to_json()


# Seperate top level manifest for groups
# Why? Harder to optimize a query that works in both cases.
# NOT PERMISSIONED AT ALL - the only manifest like this.
@bp.route('/top-level-manifest-group', methods=('GET',))
@cross_origin()
def top_level_group_manifest():
    group_id = request.args.get('group_id')
    if not group_id:
        return MyResponse(False, reason="Didn't set group; are you using the right endpoint?").to_json()
    group_id = int(group_id)

    limit = request.args.get('limit')
    if not limit or int(limit) > 100:  # max limit is 100
        limit = 10
    else:
        limit = int(limit)

    db = get_db()

    sql = f"""
    WITH ass AS (
        SELECT *
        FROM assets
        WHERE
                `template` = 'folder'
            AND `group_id` = {group_id}
        GROUP BY id
    )
    SELECT ass.*
    FROM ass
    WHERE NOT EXISTS (
        SELECT 1
        FROM asset_metadata am
        WHERE ass.id = am.value AND am.key = '{RETRIEVAL_SOURCE}' AND am.asset_id IN (SELECT id FROM ass)
    )
    ORDER BY `title` ASC
    LIMIT {limit}
    """
    curr = db.cursor()
    curr.execute(sql)
    res = curr.fetchall()
    return MyResponse(True, {'results': res}).to_json()


class Folder(Template):
    def __init__(self) -> None:
        super().__init__()
        self.chattable = True
        self.summarizable = False
        self.make_retriever_on_upload = False
        self.code = "folder"


    def build_chat_system_prompt(self, question, sources, extra_instructions="", src_title="", source_names=None):
        if source_names:
            assert(len(source_names) == len(sources))

        prompt = f"{get_basic_ai_identity()} A user is asking questions related to documents in a folder. Below are parts of documents inside the folder."
        prompt += f" Since you are only seeing parts of each document, you may not be able to recognize exactly which document the user is asking about. If you are confused, tell the user what you can see and ask for clarification."

        for i, source in enumerate(sources):
            source_name = ""
            if source_names:
                source_name = " " + source_names[i]

            prompt += f"EXCERPT from {source_name}\n"
            prompt += source
            prompt += f"\n*END of{' FINAL' if i == len(sources) - 1 else ''} EXCERPT*\n\n"

        prompt += "These excerpts may help you answer the user's question. Remember to BE CONCISE in your response.\n"
        prompt += get_citation_prompt()

        return prompt


    @needs_db
    def upload(self, user: User, asset_id, is_editing, asset_title="", using_auto_title=False, using_auto_desc=False, no_commit=True, db=None):

        selections = request.form.get("selections")
        if selections:
            selections = json.loads(selections)

        desc = request.form.get("preview_desc")
        author = request.form.get('author')

        if request.files:
            files = request.files.getlist('files')
            from .templates import get_template_by_code  # lazy importing to break circular dependency
            
            tmp: Template = get_template_by_code('document')

            def _clean_up(asset_ids):
                # Basically go through and remove uploaded files
                # Don't need to delete the whole asset though, since they weren't really created.

                # Can do this because we're using the same connection
                for id in asset_ids:
                    reses = tmp.get_asset_resources(user, id, new_conn=True)  # new conn avoids issue with db committing unexpectedly
                    delete_resources(reses)
                    
            inside_file_desc = f"Document inside {asset_title}"
            totals = []
            for f in files:
                asset_name = remove_ext(f.filename)
                ok, message = upload_asset(user, None, asset_name, inside_file_desc, inside_file_desc, 'document', author, False, no_commit=no_commit, db=db)
                if not ok:
                    pass
                else:
                    try:
                        tmp.upload_file(user, f, message, f.filename, no_commit=no_commit, db=db)  # message is asset_id
                        totals.append(message)
                        selections.append(message)
                    except PdfTooLongError:
                        try:
                            _clean_up(totals)
                        finally:
                            return False, f"Folder contains a pdf that is too long (max is {MAX_PDF_PAGES} pages)"

        set_sources(user, asset_id, selections)  # also adds the right permissions

        return True, asset_id

    @needs_db
    def get_file(self, user, asset_id, only_headers=False, rec_calls=[], ret_resp=True, name="", db=None):

        rec_calls = rec_calls + [asset_id]

        curr = db.cursor()

        this_asset = get_asset(user, asset_id)

        dirpath = tempfile.mkdtemp()

        # Just top level to start
        rec_str =  f"AND (NOT `value` IN ({','.join([str(x) for x in rec_calls])}))" if len(rec_calls) > 0 else ""
        sql = f"""
            SELECT * FROM asset_metadata
            WHERE `key`='{RETRIEVAL_SOURCE}' AND `asset_id`=%s {rec_str}
        """
        curr.execute(sql, (asset_id,))
        top_level = curr.fetchall()

        permissioning_string = get_permissioning_string(user)
    
        for source_id in map(lambda x: x['value'], top_level):
            sql = f"""
                    WITH a as (
                        SELECT *
                        FROM assets
                        WHERE `id` = %s
                    )
                    SELECT DISTINCT a.* FROM a
                    LEFT JOIN asset_permissions ap ON a.id = ap.asset_id OR a.group_id = ap.group_id
                    WHERE {permissioning_string}
                    """
            curr.execute(sql, (source_id,))
            asset_row = curr.fetchone()
            if not asset_row:
                continue

            from .templates import get_template_by_code  # lazy importing to break circular dependency
            tmp: Template = get_template_by_code(asset_row['template'])
            
            # It's possible that if get_file fails, it will return a Response 500 instead of a file
            # This will cause an error in get_extension_from_path that yields the desired effect (error) anyway.
            nested_fname = tmp.get_file(user, asset_row['id'], rec_calls=rec_calls, ret_resp=False, db=db)
            if not nested_fname:  # if it couldn't find a file (and didn't through an error)
                continue

            # Extracting file information, such as the name:
            filename = asset_row['title'] + "." + get_extension_from_path(None, nested_fname)

            path = os.path.join(dirpath, filename)

            # Copy into our directory
            with open(nested_fname, 'rb') as fhand:
                with open(path, 'wb') as temp_fhand:
                    shutil.copyfileobj(fhand, temp_fhand)

            # Remove the source
            os.remove(nested_fname)

            if filename[-4:] == ".zip":
                try:
                    shutil.unpack_archive(path, path[:-4])
                    os.remove(path)
                except Exception as e:
                    print(f"Error unzipping file. Details: {e}", file=sys.stderr)

        zip_tmp_path = tempfile.mktemp(suffix=".zip")

        shutil.make_archive(zip_tmp_path[:-4], 'zip', dirpath)

        shutil.rmtree(dirpath)

        if ret_resp:
            try:
                response = send_file(zip_tmp_path, mimetype="application/zip", download_name=this_asset['title']+".zip")
                response.headers['Access-Control-Expose-Headers'] = 'Content-Disposition'

                # I used to have cleanup code here, but I got errors saying that there were no files to cleanup
                # So I suppose I don't need it.

                return response
            finally:
                os.remove(zip_tmp_path)
        
        # Return filename
        return zip_tmp_path


    def get_asset_resources(self, *args, **kwargs):
        return super()._get_asset_resources_include_retrieval_sources(*args, **kwargs)

