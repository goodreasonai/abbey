from .template import Template
from ..db import needs_db
from ..auth import User
import sqlite3
import tempfile
import os
from ..asset_actions import add_asset_resource, get_asset_resource, get_asset, get_asset_resource_by_id, get_asset_resources_by_id, delete_asset_resources
from ..storage_interface import download_file, replace_asset_file, upload_asset_file
from ..configs.str_constants import MAIN_FILE
from flask_cors import cross_origin
from ..auth import token_optional
from flask import Blueprint, request
from ..template_response import MyResponse, response_from_resource
from ..web import ScrapeMetadata, ScrapeResponse, scrape_with_requests, scrape_with_service
from ..utils import ext_from_mimetype, get_extension_from_path, mimetype_from_ext, get_mimetype_from_headers
from ..db import with_lock, get_db
from ..integrations.file_loaders import get_loader, TextSplitter, RawChunk
from ..exceptions import ScraperUnavailable
import sys
import os


bp = Blueprint('crawler', __name__, url_prefix="/crawler")


# TODO move this into the CrawlerDB class
def create_and_upload_database(asset_id):
    temp_file = tempfile.NamedTemporaryFile(mode='w+', delete=False)
    db_path = temp_file.name
    try:
        # Connect to the SQLite database
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # You should modify /manifest and add appropriate columns if you modify this
        sql = """
            CREATE TABLE websites (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                scraped_at DATETIME,      
                title TEXT,
                author TEXT,
                text TEXT,
                content_type TEXT,
                url TEXT
            )
        """
        cursor.execute(sql)
        sql = """
            CREATE TABLE website_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                website_id INTEGER,  /* Foreign key to websites */
                data_type TEXT,  /* Like 'screenshot' or 'data' */
                resource_id INTEGER  /* Key into asset_resources */
            )
        """
        cursor.execute(sql)
        sql = """
            CREATE INDEX website_id_index ON website_data(website_id);
        """
        cursor.execute(sql)
        # Commit the changes
        conn.commit()

        path, from_key = upload_asset_file(asset_id, temp_file.name, 'sqlite')
        add_asset_resource(asset_id, MAIN_FILE, from_key, path, "Database")

    finally:
        # Close the connection
        conn.close()

        # Delete the temporary database file
        if os.path.exists(db_path):
            os.remove(db_path)


def get_crawler_lock_name(asset_id):
    return f"{asset_id}_crawler"


# Wrapers around db functions
# In the future, doesn't necessarily need to be sqlite
class CrawlerDBResult():
    def __init__(self, res):
        self.res = res  # As of rn, a sqlite result
    
    def fetchall(self):
        return self.res.fetchall()
    
    def fetchone(self):
        return self.res.fetchone()

def dict_factory(cursor, row):
    d = {}
    for idx, col in enumerate(cursor.description):
        d[col[0]] = row[idx]
    return d

class CrawlerDB():
    def __init__(self, asset_id):
        # Somewhat inefficient in that there's no caching
        # And requires downloading the entire DB
        res = get_asset_resource(asset_id, MAIN_FILE)
        if res is None:
            raise Exception(f"Couldn't find any existing crawler database for asset id {asset_id}")
        self.asset_resource = res

        tmp = tempfile.NamedTemporaryFile(delete=False)
        download_file(tmp.name, res)
        self.path = tmp.name
        conn = sqlite3.connect(self.path)
        conn.row_factory = dict_factory
        self.conn = conn
        self.asset_id = asset_id

    def execute(self, *args, **kwargs):
        res = self.conn.execute(*args, **kwargs)
        res = CrawlerDBResult(res)
        return res
    
    # Also reuploads DB
    def commit(self, *args, **kwargs):
        self.conn.commit()
        replace_asset_file(self.asset_resource['from'], self.asset_resource['path'], self.path)

    # Deletes file in addition to closing connection
    def close(self, *args, **kwargs):
        self.conn.close(*args, **kwargs)
        os.remove(self.path)


@bp.route('/manifest', methods=('GET',))
@cross_origin()
@token_optional
def get_manifest(user: User):
    asset_id = request.args.get('id')
    asset_row = get_asset(user, asset_id)
    if not asset_row:
        return MyResponse(False, status=404, reason="Asset not found")

    limit = int(request.args.get('limit', 30))
    if limit > 500:
        limit = 500

    offset = request.args.get('offset', 0)

    conn = CrawlerDB(asset_id)

    # Query to get the total number of results
    # Annoyingly run the query twice to get a "total"
    sql = """
        SELECT COUNT(*) as _total FROM websites
    """
    res = conn.execute(sql)
    total = res.fetchone()['_total']
    # Actual query
    sql = """
       SELECT 
            websites.id,
            websites.created_at,
            websites.scraped_at,
            websites.title,
            websites.author,
            websites.content_type,
            websites.url,
            COALESCE(json_group_array(json_object(
                'data_type', website_data.data_type,
                'resource_id', website_data.resource_id
            )), '[]') AS website_data
        FROM websites
        LEFT JOIN website_data ON websites.id = website_data.website_id
        GROUP BY websites.id
        ORDER BY websites.created_at DESC
        LIMIT ? OFFSET ?
    """
    res = conn.execute(sql, (limit, offset))
    results = res.fetchall()

    conn.close()  # Very important

    return MyResponse(True, {'results': results, 'total': total}).to_json()


@bp.route('/remove', methods=('POST',))
@cross_origin()
@token_optional
def remove_website(user: User):
    asset_id = request.json.get('id')
    asset_row = get_asset(user, asset_id)
    if not asset_row:
        return MyResponse(False, status=404, reason="Asset not found").to_json()

    row_id = request.json.get('row_id')

    db = get_db()
    try:
        # Lock and remove from the database
        @with_lock(get_crawler_lock_name(asset_id), db)
        def remove_from_db():
            crawler = CrawlerDB(asset_id)

            # Note the associated website data and remove their resources from the global db
            # Remove the websites entry and websites data entries

            sql = """
                SELECT * FROM website_data
                WHERE `website_id` = ?;
            """
            res = crawler.execute(sql, (row_id,))
            website_data_rows = res.fetchall()

            # Remove associated resources
            resource_ids = [x['resource_id'] for x in website_data_rows]
            asset_resources = get_asset_resources_by_id(asset_id, resource_ids, db=db)
            delete_asset_resources(asset_resources)
            
            sql = """
                DELETE FROM websites
                WHERE `id`=?
            """
            crawler.execute(sql, (row_id,))

            sql = """
                DELETE FROM website_data
                WHERE `website_id`=?
            """
            crawler.execute(sql, (row_id,))

            crawler.commit()
            crawler.close()
        
        remove_from_db()    
    finally:
        db.close()

    return MyResponse(True).to_json()

@bp.route('/add', methods=('POST',))
@cross_origin()
@token_optional
def add_url(user: User):
    asset_id = request.json.get('id')
    asset_row = get_asset(user, asset_id)
    if not asset_row:
        return MyResponse(False, status=404, reason="Asset not found").to_json()

    url = request.json.get('url')

    db = get_db()
    # Lock and add to the database
    @with_lock(get_crawler_lock_name(asset_id), db)
    def add_to_db():
        crawler = CrawlerDB(asset_id)
        sql = """
            INSERT INTO websites (`url`)
            VALUES (?)
        """
        crawler.execute(sql, (url,))

        sql = """
            SELECT * FROM websites
            WHERE rowid = last_insert_rowid();
        """
        res = crawler.execute(sql)
        updated = res.fetchone()
        
        crawler.commit()
        crawler.close()

        return updated
    
    new_row = add_to_db()    
    db.close()

    return MyResponse(True, {'result': new_row}).to_json()


@bp.route('/scrape', methods=('POST',))
@cross_origin()
@token_optional
def scrape_one_site(user: User):
    asset_id = request.json.get('id')
    asset_row = get_asset(user, asset_id)
    if not asset_row:
        return MyResponse(False, status=404, reason="Asset not found").to_json()

    item = request.json.get('item')

    if 'id' not in item or 'url' not in item:
        return MyResponse(False, status=400, reason="Item not valid").to_json()

    # Scrape the site
    try:
        scrape: ScrapeResponse = scrape_with_service(item['url'])
    except ScraperUnavailable:
        print("Scraper service unavailable; falling back to request scrape.", file=sys.stderr)
        scrape: ScrapeResponse = scrape_with_requests(item['url'])

    if not scrape.success:
        return MyResponse(False, {'scrape_status': scrape.status, 'headers': scrape.headers}, status=500, reason=f"Scrape was not success").to_json()

    content_type = get_mimetype_from_headers(scrape.headers)
    meta: ScrapeMetadata = scrape.metadata
    ext = ext_from_mimetype(meta.content_type)
    MAX_TEXT_LENGTH = 100_000  # in characters
    text = ""
    db = get_db()
    with scrape.consume_data() as data_path:
        loader = get_loader(ext, data_path)
        splitter = TextSplitter(max_chunk_size=1024)
        splits = loader.load_and_split(splitter)
        for x in splits:
            x: RawChunk
            if len(text) + len(x.page_content) < MAX_TEXT_LENGTH:
                text += x.page_content
        # Lock and add to the database
        @with_lock(get_crawler_lock_name(asset_id), db)
        def add_to_db():
            crawler = CrawlerDB(asset_id)
            sql = """
                UPDATE websites
                SET `title`=?,
                    `author`=?,
                    `text`=?,
                    `content_type`=?,
                    `scraped_at`=CURRENT_TIMESTAMP
                WHERE `id`=?
            """
            crawler.execute(sql, (meta.title, meta.author, text, content_type, item['id']))

            # Does old scrape data exist?
            # If so, delete from storage, asset_resources, and from the crawler db
            sql = """
                SELECT * FROM website_data
                WHERE `website_id`=?
            """
            res = crawler.execute(sql, (item['id'],))
            existing_data = res.fetchall()
            if len(existing_data):
                resources = get_asset_resources_by_id(asset_id, [x['resource_id'] for x in existing_data], db=db)
                delete_asset_resources(resources, db=db)
                sql = """
                    DELETE FROM website_data
                    WHERE `website_id`=?
                """
                crawler.execute(sql, (item['id'],))

            # Upload and insert the data
            path, from_val = upload_asset_file(asset_id, data_path, ext)
            assoc_file_id = add_asset_resource(asset_id, 'website', from_val, path, None, db=db)

            sql = """
                INSERT INTO website_data (`website_id`, `data_type`, `resource_id`)
                VALUES (?, ?, ?)
            """
            crawler.execute(sql, (item['id'], 'data', assoc_file_id))

            # Upload any screenshots available
            while len(scrape.screenshot_paths):
                with scrape.consume_screenshot() as ss_path:
                    # Upload and insert the data
                    path, from_val = upload_asset_file(asset_id, ss_path, 'jpg')
                    assoc_file_id = add_asset_resource(asset_id, 'website', from_val, path, None, db=db)

                    sql = """
                        INSERT INTO website_data (`website_id`, `data_type`, `resource_id`)
                        VALUES (?, ?, ?)
                    """
                    crawler.execute(sql, (item['id'], 'screenshot', assoc_file_id))

            # Get currently entry including the resources
            # Meant to mimic an entry returned in /manifest
            sql = """
                SELECT
                    websites.*,
                    COALESCE(json_group_array(json_object(
                        'data_type', website_data.data_type,
                        'resource_id', website_data.resource_id
                    )), '[]') AS website_data
                FROM websites
                LEFT JOIN website_data ON websites.id = website_data.website_id
                WHERE websites.id=?
                GROUP BY websites.id
            """
            res = crawler.execute(sql, (item['id'],))
            updated = res.fetchone()
            
            crawler.commit()
            crawler.close()

            return updated
        
        new_row = add_to_db()

    return MyResponse(True, {'result': new_row}).to_json()


class Crawler(Template):
    def __init__(self) -> None:
        super().__init__()
        self.chattable = False
        self.summarizable = False
        self.code = "crawler"

    @needs_db
    def upload(self, user: User, asset_id, asset_title="", using_auto_title=False, using_auto_desc=False, db=None):
        # Create the initial sqlite database file and store it
        create_and_upload_database(asset_id)
        return True, asset_id
    
    @needs_db
    def get_file(self, user, asset_id, only_headers=False, rec_calls=[], name=None, ret_resp=True, db=None):

        if name is None:
            return None
        
        try:
            name = int(name)
        except:
            raise Exception("Crawler files are accessed via resource IDs rather than names")
        
        res = get_asset_resource_by_id(asset_id, name, db=db)
        if not res and ret_resp:
            response_status = 404
            return MyResponse(False, reason=f"No file found for asset with id {asset_id}", status=response_status).to_json()
        elif not res:
            return None

        ext = get_extension_from_path(None, res['path'])
        mimetype = mimetype_from_ext(ext)
        
        if ret_resp:
            real_title = res['title'] or "file"
            return response_from_resource(res, mimetype, filename=real_title+ "." +ext, only_headers=only_headers)
        
        # Returning file path
        ext = get_extension_from_path(None, res['path'])
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix="."+ext)
        download_file(temp_file.name, res)
        return temp_file.name

