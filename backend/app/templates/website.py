from flask import (
    Blueprint,
    request,
)
from flask_cors import cross_origin

from ..auth import User, token_required
from ..db import get_db, needs_db
from ..template_response import MyResponse
import json
from .template import Template
from ..storage_interface import upload_asset_file, delete_resources
from ..asset_actions import get_asset, has_asset_title_been_updated, replace_asset_resource, has_asset_desc_been_updated
from ..web import scrape
from ..configs.str_constants import MAIN_FILE
import tempfile

bp = Blueprint('website', __name__, url_prefix="/website")


# TODO: move to asset_actions and replace other instances of INSERT INTO asset_metadata
@needs_db
def insert_meta(asset_id, key, val, db=None):
    curr = db.cursor()
    sql = """
    DELETE FROM asset_metadata
    WHERE `asset_id` = %s AND `key` = %s
    """
    curr.execute(sql, (asset_id, key))
    sql = """
    INSERT INTO asset_metadata (`asset_id`, `key`, `value`)
    VALUES (%s, %s, %s)
    """
    curr.execute(sql, (asset_id, key, val))


@needs_db
def insert_meta_description(asset_id, desc, db=None, no_commit=False):
    insert_meta(asset_id, 'description', desc, db=None, no_commit=no_commit)

@needs_db
def insert_meta_favicon(asset_id, favicon_url, db=None, no_commit=False):
    insert_meta(asset_id, 'favicon', favicon_url, db=None, no_commit=no_commit)

@needs_db
def insert_meta_image_url(asset_id, image_url, db=None, no_commit=False):
    insert_meta(asset_id, 'image_url', image_url, db=None, no_commit=no_commit)

@needs_db
def insert_meta_url(asset_id, url, db=None, no_commit=False):
    insert_meta(asset_id, 'url', url, db=None, no_commit=no_commit)

@needs_db
def insert_meta_author(asset_id, author, db=None, no_commit=False):
    insert_meta(asset_id, 'author', author, db=None, no_commit=no_commit)


@needs_db
def scrape_and_upload(url, asset_id, asset_title, use_html=None, ignore_title=False, no_commit=False, db=None):
    response = scrape(url, use_html=use_html, just_text=True, reduce_whitespace=True)
    if not response['success']:
        return False, response['reason']

    path, from_key = upload_asset_file(asset_id, None, response['ext'], use_data=response['data'])
    curr = db.cursor()

    replace_asset_resource(asset_id, MAIN_FILE, from_key, path, asset_title, no_commit=no_commit, db=db)

    insert_meta_url(asset_id, url)
    if 'favicon' in response and response['favicon']:
        insert_meta_favicon(asset_id, response['favicon'], db=db, no_commit=no_commit)
    if 'description' in response and response['description']:
        insert_meta_description(asset_id, response['description'], db=db, no_commit=no_commit)
        if not has_asset_desc_been_updated(asset_id, db=db, no_commit=True):
            sql = """
            UPDATE assets SET `preview_desc` = %s WHERE id = %s
            """
            curr.execute(sql, (response['description'], asset_id))
    if 'author' in response and response['author']:
        insert_meta_author(asset_id, response['author'], db=db, no_commit=no_commit)
        sql = """
        UPDATE assets SET `author` = %s WHERE id = %s
        """
        curr.execute(sql, (response['author'], asset_id))
    if 'image_url' in response and response['image_url']:
        insert_meta_image_url(asset_id, response['image_url'], db=db, no_commit=no_commit)

    if not ignore_title and  'title' in response and not has_asset_title_been_updated(asset_id, db=db, no_commit=True):
        sql = """
        UPDATE assets SET title = %s WHERE id = %s
        """
        curr.execute(sql, (response['title'], asset_id))
    
    return True, asset_id

@bp.route('/rescrape', methods=('POST',))
@cross_origin()
@token_required
def rescrape(user: User):
    asset_id = request.json.get('id')
    url = request.json.get('url')
    asset_title = request.json.get('title')

    if not url:
        return MyResponse(False, reason="No url specified").to_json()

    asset_row = get_asset(user, asset_id, needs_edit_permission=True)
    if not asset_row:
        return MyResponse(False, reason="Could not find asset").to_json()

    db = get_db()
    result, reason = scrape_and_upload(url, asset_id, asset_title, db=db)
    db.commit()

    return MyResponse(result, reason=reason).to_json()

class Website(Template):
    def __init__(self) -> None:
        super().__init__()
        self.chattable = True
        self.summarizable = True
        self.code = "website"

    # remember, could also be editing!
    @needs_db
    def upload(self, user: User, asset_id, asset_title="", using_auto_title=False, using_auto_desc=False, no_commit=False, db=None):
        url = request.form.get("url")
        if not url:
            return False, "No url specified"

        use_html = None
        if request.files and request.files.get('files'):
            file_obj = request.files.get('files')
            use_html = file_obj.read().decode('utf-8')

        return scrape_and_upload(url, asset_id, asset_title, use_html=use_html, ignore_title=not using_auto_title, db=db, no_commit=no_commit)

