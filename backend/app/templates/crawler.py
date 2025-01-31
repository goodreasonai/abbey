from .template import Template
from ..db import needs_db, db_polling_lock, db_release_lock
from ..auth import User
import sqlite3
import tempfile
import os
from ..asset_actions import (
    add_asset_resource, upload_asset, get_asset_resource, get_asset, get_asset_resource_by_id,
    get_asset_resources_by_id, delete_asset_resources, get_asset_metadata, save_asset_metadata,
    add_bulk_asset_metadata, delete_asset_metadata_by_id, set_sources
)
from ..storage_interface import download_file, replace_asset_file, upload_asset_file
from ..configs.str_constants import MAIN_FILE
from flask_cors import cross_origin
from ..auth import token_required, SynthUser, token_optional
from flask import Blueprint, request
from ..template_response import MyResponse, response_from_resource
from ..web import ScrapeMetadata, ScrapeResponse, scrape_with_requests, scrape_with_service
from ..utils import ext_from_mimetype, get_extension_from_path, mimetype_from_ext, get_mimetype_from_headers, get_token_estimate
from ..db import with_lock, get_db
from ..integrations.file_loaders import get_loader, TextSplitter, RawChunk
from ..exceptions import ScraperUnavailable, QueueDuplicate, QueueFull
from ..user import get_user_search_engine_code
from ..integrations.web import SearchEngine, SEARCH_PROVIDERS, SearchResult
from ..integrations.lm import LM, LM_PROVIDERS, HIGH_PERFORMANCE_CHAT_MODEL, VISION_MODEL, get_safe_retrieval_context_length
import sys
import os
import json
from ..jobs import search_for_jobs, start_job, job_error_wrapper, complete_job
from ..worker import task_scrape_from_queue
import traceback
from .website import insert_meta_author, insert_meta_description, insert_meta_url
from ..prompts.crawler_prompts import get_suggest_from_topic_system, get_scrape_quality_system, get_scrape_quality_user_text, get_scrape_quality_user, get_eval_system, get_eval_user
import base64


bp = Blueprint('crawler', __name__, url_prefix="/crawler")

DB_VERSION: int = 6  # increment this in order to redo the schema on older DBs.

SCRAPE_QUEUE = 'scrape_queue'  # metadata key
SCRAPE_FROM_QUEUE_JOB = 'scrape_queue'  # job kind
RESEARCH_TOPIC = 'topic'  # metadata key (also appears in frontend)


def create_database(path):
    # Connect to the SQLite database
    try:
        conn = sqlite3.connect(path)
        cursor = conn.cursor()

        # You should modify /manifest and add appropriate columns if you modify this
        sql = """
            CREATE TABLE websites (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                scraped_at DATETIME,      
                title TEXT,
                author TEXT,
                desc TEXT,
                text TEXT,
                content_type TEXT,
                asset_id INTEGER,
                scrape_quality_code TEXT,
                url TEXT
            )
        """
        cursor.execute(sql)
        sql = """
            CREATE INDEX url_index ON websites(url COLLATE NOCASE);
        """
        # You should modify /manifest and add appropriate columns if you modify this
        sql = """
            CREATE TABLE errors (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                website_id INTEGER,
                traceback TEXT,  /* if applicable */
                stage TEXT,  /* Where was the error caught? */
                status INTEGER  /* If we have it, what was the scrape response status? */
            )
        """
        cursor.execute(sql)
        sql = """
            CREATE INDEX website_id_error_index ON errors(website_id);
        """
        cursor.execute(sql)  # Additionally makes any query on URL case insensitive
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

        sql = """
            CREATE TABLE evaluations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                website_id INTEGER,  /* Foreign key to websites */
                source_type TEXT,
                trustworthiness INTEGER,
                max_trustworthiness INTEGER,  /* Would typically be same for all, but helps when changing out values */
                relevance INTEGER,
                max_relevance INTEGER,
                topic TEXT,
                title TEXT,
                author TEXT,
                desc TEXT
            )
        """
        cursor.execute(sql)
        sql = """
            CREATE INDEX website_id_evaluations_index ON evaluations(website_id);
        """
        cursor.execute(sql)

        # Now create the virtual table for fts5 search + triggers to keep it in sync.
        sql = """
            CREATE VIRTUAL TABLE IF NOT EXISTS websites_fts5 USING fts5(
                website_id UNINDEXED,
                title,
                author,
                desc,
                text
            );
        """
        cursor.execute(sql)
        sql = """
            CREATE TRIGGER IF NOT EXISTS after_websites_insert
            AFTER INSERT ON websites
            BEGIN
                INSERT INTO websites_fts5 (website_id, title, author, desc, text) VALUES (NEW.id, NEW.title, NEW.author, NEW.desc, NEW.text);
            END;
        """
        cursor.execute(sql)
        sql = """
            CREATE TRIGGER IF NOT EXISTS after_websites_update
            AFTER UPDATE ON websites
            BEGIN
                DELETE FROM websites_fts5 WHERE website_id = OLD.id;
                INSERT INTO websites_fts5 (website_id, title, author, desc, text) VALUES (NEW.id, NEW.title, NEW.author, NEW.desc, NEW.text);
            END;
        """
        cursor.execute(sql)
        sql = """
            CREATE TRIGGER IF NOT EXISTS after_websites_delete
            AFTER DELETE ON websites
            BEGIN
                DELETE FROM websites_fts5 WHERE website_id = OLD.id;
            END;
        """
        cursor.execute(sql)

        sql = f"""
            PRAGMA user_version = {DB_VERSION}
        """
        cursor.execute(sql)

        conn.commit()
    finally:
        conn.close()


# TODO move this into the CrawlerDB class
def create_and_upload_database(asset_id):
    temp_file = tempfile.NamedTemporaryFile(mode='w+', delete=False)
    db_path = temp_file.name
    try:
        create_database(db_path)
        path, from_key = upload_asset_file(asset_id, temp_file.name, 'sqlite')
        add_asset_resource(asset_id, MAIN_FILE, from_key, path, "Database")
    finally:
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
    def __init__(self, asset_id, read_only=False, db=None):  # Note that db is an argument, but the class doesn't use needs_db
        # Somewhat inefficient in that there's no caching
        # And requires downloading the entire DB
        res = get_asset_resource(asset_id, MAIN_FILE, db=db)
        if res is None:
            raise Exception(f"Couldn't find any existing crawler database for asset id {asset_id}")
        self.asset_resource = res
        self.db = db
        tmp = tempfile.NamedTemporaryFile(delete=False)
        download_file(tmp.name, res)
        self.path = tmp.name
        conn = sqlite3.connect(self.path)
        conn.row_factory = dict_factory
        self.conn = conn
        self.asset_id = asset_id
        self.read_only = read_only

        self._check_version_and_update()

    def _check_version_and_update(self):
        sql = "PRAGMA user_version"
        res = self.execute(sql)
        version = res.fetchone()['user_version']
        if version < DB_VERSION:
            # Create new database
            temp_file = tempfile.NamedTemporaryFile(mode='w+', delete=False)
            db_path = temp_file.name

            create_database(db_path)
            new_conn = sqlite3.connect(db_path)
            new_conn.row_factory = dict_factory

            new_cursor = new_conn.cursor()
            old_cursor = self.conn.cursor()

            # Should be updated as new tables are added (OK if don't exist in previous database)
            tables_to_reconstruct = ['websites', 'website_data', 'errors', 'evaluations']

            for table in tables_to_reconstruct:
                # Get common columns first
                new_cursor.execute(f"PRAGMA table_info({table});")
                new_columns = {col["name"] for col in new_cursor.fetchall()}

                old_cursor.execute(f"PRAGMA table_info({table});")
                old_columns = {col["name"] for col in old_cursor.fetchall()}

                common_columns = new_columns.intersection(old_columns)
                if not common_columns:
                    continue

                columns_list = ", ".join(common_columns)

                # 1. Read rows from old DB in one go (or chunked if data is huge).
                select_sql = f"SELECT {columns_list} FROM {table}"
                old_cursor.execute(select_sql)
                rows = old_cursor.fetchall()

                # 2. Insert them into new DB efficiently:
                placeholders = ", ".join(["?"] * len(common_columns))
                insert_sql = f"INSERT INTO {table} ({columns_list}) VALUES ({placeholders})"

                # Wrap in a transaction for fewer commits
                new_conn.execute("BEGIN TRANSACTION;")
                # executemany can take an iterable of tuples
                new_cursor.executemany(
                    insert_sql,
                    (
                        tuple(row_dict[col] for col in common_columns)
                        for row_dict in rows
                    ),
                )
                new_conn.execute("COMMIT;")

            new_conn.commit()
            
            new_cursor.close()
            old_cursor.close()

            # Remove the old database and attach new one
            os.remove(self.path)
            self.path = db_path
            self.conn = new_conn

            # Notably, will NOT reupload the DB unless the user commits.

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

    def __enter__(self):
        # Returning the CrawlerDB object like "with CrawlerDB(...) as db:"
        # Acquire the lock
        if not self.read_only:
            has_lock = db_polling_lock(get_crawler_lock_name(self.asset_id), db=self.db)
            if not has_lock:
                raise Exception(f"Couldn't acquire the lock for CrawlerDB on asset with id {self.asset_id}")
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        # Remove the temporary file when done
        try:
            self.close()
        finally:
            if not self.read_only:
                db_release_lock(get_crawler_lock_name(self.asset_id), db=self.db)


class ScrapeQueueItem():
    website_id: int
    def __init__(self, website_id=None):
        self.website_id = website_id
    
    def to_json(self):
        return {
            'website_id': self.website_id
        }


class ScrapeQuality():
    def __init__(self, code: str, proceed: bool, name: str, desc: str):
        self.code = code.upper()
        self.proceed = proceed
        self.name = name
        self.desc = desc

# On frontend as well
SCRAPE_QUALITY = [
    ScrapeQuality('COL', True, 'Collected', 'If a source is essentially legible, even if its text requires scrolling further'),
    ScrapeQuality('POBS', True, 'Partially Obscured', 'If a source is almost entirely legible, but dimmed or behind a small popup, even if its text requies scrolling further'),
    ScrapeQuality('RLOG', False, 'Requires Login', 'If a source is almost entirely obscured or cut off because the user is not signed in'),
    ScrapeQuality('OBS', False, 'Obscured', 'If a source is essentially wholly obscured or not present in the screenshots for other reasons'),
]
# Not sent to the AI, but a valid response
NO_JUDGEMENT = ScrapeQuality('NJ', False, 'No Judgement', 'If no confirmation as to whether the scrape proceeded correctly can be inferred from the data, due to errors or other limitations')
ASSUME_COLLECTED = ScrapeQuality('ACOL', True, 'Assume Collected', 'A full judgement could not be made, but assume that the data were collected.')
QUALITY_CODES = {x.code: x for x in [*SCRAPE_QUALITY, NO_JUDGEMENT, ASSUME_COLLECTED]}


class SourceType():
    def __init__(self, code: str, desc: str, name: str):
        self.code = code
        self.desc = desc
        self.name = name

# On frontend as well
SOURCE_TYPES = [
    SourceType('NEWS', 'If the source is a news media article', 'News Article'),
    SourceType('GOV', 'If the source is an official government publication or release (not counting state-owned media)', 'Government Report'),
    SourceType('SOC', 'If the source is a social media post', 'Social Media'),
    SourceType('EDU', 'If the source is an academic article or other scholarly publication', 'Academic Article'),
    SourceType('WIKI', 'If the source is from an online wiki, like Wikipedia or Encycolopedia Brittanica', 'Wiki'),
    SourceType('BUS', 'If the source is a businesses landing page or other official promotional material', 'Business Page'),
    SourceType('BLG', 'If the source is a personal or unofficial blog, like on Medium', 'Blog'),
    SourceType('OTH', 'If the source is none of the above', 'Other'),
]
UNKNOWN_SOURCE_TYPE = SourceType('UNK', 'If the type of source cannot be determined because there isn\'t enough information', 'Unknown')
CODE_TO_SOURCE_TYPES = {x.code: x for x in SOURCE_TYPES + [UNKNOWN_SOURCE_TYPE]}

class ScrapeEval():
    def __init__(
        self, 
        title: str,
        author: str,
        desc: str,
        source_type_code: str,
        trustworthiness: int,
        max_trustworthiness: int,
        relevance: int,
        max_relevance: int,
        topic: str,
    ):
        self.title = title
        self.author = author
        self.desc = desc
        self.source_type_code = source_type_code
        self.trustworthiness = trustworthiness
        self.max_trustworthiness = max_trustworthiness
        self.relevance = relevance
        self.max_relevance = max_relevance
        self.topic = topic


# Takes care of opening up the Crawler DB
@needs_db
def record_error(asset_id, website_id, traceback="", stage="", status: int=None, db=None):
    with CrawlerDB(asset_id, db=db) as crawler:
        sql = """
            INSERT INTO errors (`website_id`, `traceback`, `stage`, `status`)
            VALUES (?, ?, ?, ?)
        """
        crawler.execute(sql, (website_id, traceback, stage, status))
        crawler.commit()


@needs_db
def scrape_for_crawler(user, asset_id, website_id, website_data=None, db=None):    
    
    item = website_data
    if not item:
        with CrawlerDB(asset_id, read_only=True, db=db) as crawler:
            sql = "SELECT * FROM websites WHERE `id` = ?"
            res = crawler.execute(sql, (website_id,))
            item = res.fetchone()

    # Scrape the site
    try:
        scrape: ScrapeResponse = scrape_with_service(item['url'])
    except ScraperUnavailable:
        print("Scraper service unavailable; falling back to request scrape.", file=sys.stderr)
        scrape: ScrapeResponse = scrape_with_requests(item['url'])

    if not scrape.success:
        return scrape.success, scrape.status

    content_type = get_mimetype_from_headers(scrape.headers)
    meta: ScrapeMetadata = scrape.metadata
    ext = ext_from_mimetype(meta.content_type)
    MAX_TEXT_LENGTH = 100_000  # in characters
    db = get_db()
    with scrape.consume_data() as data_path:
        with scrape.consume_screenshots() as (ss_paths, ss_types):
            loader = get_loader(ext, data_path)
            splitter = TextSplitter(max_chunk_size=1024)
            splits = loader.load_and_split(splitter)

            total_toks = 0
            text = ""  # For putting in the DB
            safe_remaining = ""  # Text for eval (might be of different length)
            eval_lm: LM = LM_PROVIDERS[HIGH_PERFORMANCE_CHAT_MODEL]  # For evaluation
            safe_remaining_n_tokens = get_safe_retrieval_context_length(eval_lm)
            for x in splits:
                x: RawChunk
                if len(text) + len(x.page_content) < MAX_TEXT_LENGTH:
                    text += x.page_content
                page_toks = get_token_estimate(x.page_content)
                if safe_remaining_n_tokens > page_toks:
                    safe_remaining += x.page_content
                else:
                    safe_remaining_n_tokens = 0
                total_toks += page_toks
            
            # TODO: evaulate the scrape
            quality_code = ASSUME_COLLECTED.code
            if len(ss_paths):
                # Get an evaluation of scrape quality from first two screenshots
                lm: LM = LM_PROVIDERS[VISION_MODEL]
                
                try:
                    if lm.accepts_images:
                        txt = get_scrape_quality_user(scrape.url)
                        system_prompt = get_scrape_quality_system(SCRAPE_QUALITY)
                        images = []
                        for ss_path, ss_type in zip(ss_paths, ss_types):
                            with open(ss_path, "rb") as image_file:
                                # Read the image file in binary mode
                                encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
                                encoded_string = f"data:{ss_type};base64,{encoded_string}"
                                images.append(encoded_string)
                        resp = lm.run(txt, system_prompt=system_prompt, images=images, make_json=True)
                        my_json = json.loads(resp)
                        quality_code = my_json['quality_code']
                    else:
                        lm = LM_PROVIDERS[HIGH_PERFORMANCE_CHAT_MODEL]
                        system_prompt = get_scrape_quality_system(SCRAPE_QUALITY)
                        # Shorten text so that it fits with model
                        get_token_estimate(text)
                        txt = get_scrape_quality_user_text(scrape.url, text)
                        resp = lm.run(txt, system_prompt=system_prompt, make_json=True)
                        my_json = json.loads(resp)
                        quality_code = my_json['quality_code']
                except Exception as _:
                    print(f"Quality eval failed:\n {traceback.format_exc()}", file=sys.stderr)
                    quality_code = NO_JUDGEMENT.code
            elif len(text) > 20:
                # No screenshots because it's probably a file - just check to see if there's some text
                # Assume collected
                quality_code = ASSUME_COLLECTED.code
            else:
                quality_code = NO_JUDGEMENT.code

            # Ensure quality code is actually real
            quality_code = quality_code.upper()
            quality_obj = None
            if quality_code not in QUALITY_CODES:
                print(f"Quality code '{quality_code}' was not in QUALITY_CODES", file=sys.stderr)
                quality_obj = NO_JUDGEMENT
            else:
                quality_obj = QUALITY_CODES[quality_code]
            
            # If only partially obscured or fully collected, try to extract (1) source, (2) author / source, (3) description, (4) source trustworthiness score, (5) relevance to topic
            
            eval = None
            if quality_obj.proceed:
                # Extract stuff TODO
                # txt = get_scrape_eval_user_text(scrape.url, text)
                # system_prompt = get_scrape_quality_system(SCRAPE_QUALITY)
                try:
                    topic = None
                    topic_meta, _ = get_asset_metadata(user, asset_id, keys=[RESEARCH_TOPIC], for_all_users=True, get_total=False)
                    if len(topic_meta):
                        topic = topic_meta[0]['value']

                    MAX_TRUSTWORTHINESS = 5
                    MAX_RELEVANCE = 5
                    system_prompt = get_eval_system(SOURCE_TYPES, topic, 5, 5)
                    txt = get_eval_user(scrape.url, text)
                    res = eval_lm.run(txt, system_prompt=system_prompt, make_json=True)
                    my_json = json.loads(res)
                    source_type_code = my_json['source_type_code']
                    if source_type_code not in CODE_TO_SOURCE_TYPES:
                        source_type_code = UNKNOWN_SOURCE_TYPE.code
                    eval = ScrapeEval(
                        my_json['title'],
                        my_json['author'],
                        my_json['desc'],
                        source_type_code,
                        my_json['trustworthiness'],
                        MAX_TRUSTWORTHINESS,
                        my_json['relevance'],
                        MAX_RELEVANCE,
                        topic
                    )
                except Exception as _:
                    print(f"Comprehensive eval failed:\n {traceback.format_exc()}", file=sys.stderr)
                    quality_code = NO_JUDGEMENT.code
            
            # Lock and add to the database
            with CrawlerDB(asset_id, db=db) as crawler:
                sql = """
                    UPDATE websites
                    SET `title`=?,
                        `author`=?,
                        `desc`=?,
                        `text`=?,
                        `content_type`=?,
                        `scrape_quality_code`=?,
                        `scraped_at`=CURRENT_TIMESTAMP
                    WHERE `id`=?
                """
                crawler.execute(sql, (meta.title, meta.author, meta.desc, text, content_type, quality_code, item['id']))

                # Put in the latest evaluation
                if eval is not None:
                    sql = """
                        DELETE FROM evaluations
                        WHERE `website_id`=?
                    """
                    # Upload and insert the data
                    sql = """
                        INSERT INTO evaluations (
                            `website_id`,
                            `source_type`,
                            `trustworthiness`,
                            `max_trustworthiness`,
                            `relevance`,
                            `max_relevance`,
                            `topic`,
                            `title`,
                            `author`,
                            `desc`
                        )
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """
                    crawler.execute(sql, (item['id'], eval.source_type_code, eval.trustworthiness, eval.max_trustworthiness, eval.relevance, eval.max_relevance, eval.topic, eval.title, eval.author, eval.desc))

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
                for ss_path in ss_paths:
                    # Upload and insert the data
                    path, from_val = upload_asset_file(asset_id, ss_path, 'jpg')
                    assoc_file_id = add_asset_resource(asset_id, 'website', from_val, path, None, db=db)

                    sql = """
                        INSERT INTO website_data (`website_id`, `data_type`, `resource_id`)
                        VALUES (?, ?, ?)
                    """
                    crawler.execute(sql, (item['id'], 'screenshot', assoc_file_id))

                crawler.commit()

    return scrape.success, scrape.status


@needs_db
def scrape_from_queue_job(user_obj, job_id, asset_id, db=None):
    user = SynthUser(user_obj)
    @job_error_wrapper(job_id)
    def do_job():
        # Get first job from queue
        # Scrape the site
        # Save into crawler DB
        # Remove from the queue
        # repeat until queue empty
        queue, _ = get_asset_metadata(user, asset_id, keys=[SCRAPE_QUEUE], limit=100, get_total=False, for_all_users=True, db=db)
        while len(queue):
            to_scrape = queue[0]
            to_scrape_obj = json.loads(to_scrape['value'])
            queue_item = ScrapeQueueItem(**to_scrape_obj)
            try:
                # This not only scrapes but also saves the data in the crawler db
                success, status = scrape_for_crawler(user, asset_id, queue_item.website_id, db=db)
            except Exception as e:
                print(f"Error in scrape for crawler: {e}", file=sys.stderr)
                record_error(asset_id, queue_item.website_id, stage='call_scrape_for_crawler', traceback=traceback.format_exc(), db=db)
                success = True
            if not success:
                # Means scrape_for_crawler handed error gracefully
                record_error(asset_id, queue_item.website_id, stage='scrape_for_crawler_returned_not_success', status=status, db=db)

            # Remove from the queue
            delete_asset_metadata_by_id(to_scrape['id'], db=db)

            queue, _ = get_asset_metadata(user, asset_id, keys=[SCRAPE_QUEUE], limit=100, get_total=False, for_all_users=True, db=db)
            # Use the filter in case the change doesn't commit fast enough
            queue = [x for x in filter(lambda x: x['id'] != to_scrape['id'], queue)]

    do_job()
    complete_job(job_id)


@needs_db
def search_sites(asset_id, query="", limit=20, offset=0, website_ids=None, filter_by_scrape: list=None, filter_by_source_type: list=None, get_total=True, order_by=None, asc=False, db=None):
    # See specification of an "fts5 string" here: https://www.sqlite.org/fts5.html#full_text_query_syntax
    # Note that quotes are doubled up
    escaped_query = query.replace('"', '""')
    quoted_query = f'"{escaped_query}"'

    # Need to update if the schema changes
    website_cols = [
        'id',
        'created_at',
        'scraped_at',
        'title',
        'author',
        'desc',
        'content_type',
        'asset_id',
        'scrape_quality_code',
        'url'
    ]
    if order_by is None:
        order_by = 'created_at'
    elif order_by in website_cols:
        pass
    else:
        raise Exception(f"Order by '{order_by}' is not an accessible column")    

    eval_cols = [
        'source_type',
        'relevance',
        'max_relevance',
        'trustworthiness',
        'max_trustworthiness',
        'topic',
        'title',
        'author',
        'desc'
    ]

    results = []
    total = None
    with CrawlerDB(asset_id, read_only=True, db=db) as conn:
        
        query_args = [query] if query else []

        website_ids_clause = ""
        if website_ids is not None:
            str_ids = ['?' for _ in website_ids]
            website_ids_clause = f'AND websites.id IN ({",".join(str_ids)})'
            query_args.extend(website_ids)
        
        website_cols_clause = ",".join([f"websites.{x}" for x in website_cols])

        eval_cols_clause = ",".join([f"ev.{x} AS eval_{x}" for x in eval_cols])

        filter_by_scrape_clause = ""
        if filter_by_scrape and len(filter_by_scrape):
            filter_by_scrape_clause = f"AND websites.scrape_quality_code IN ({','.join(['?' for _ in filter_by_scrape])})"
            query_args.extend(filter_by_scrape)

        filter_by_source_type_clause = ""
        if filter_by_source_type and len(filter_by_source_type):
            filter_by_source_type_clause = f"AND ev.source_type IN ({','.join(['?' for _ in filter_by_source_type])})"
            query_args.extend(filter_by_source_type)

        query_args.extend([limit, offset])

        # Query to get the total number of results
        if get_total:
            # Annoyingly run the query twice to get a "total"
            # TODO make it work with website_ids
            total_args = [quoted_query] if query else []
            if filter_by_scrape_clause:
                total_args.extend(filter_by_scrape)
            if filter_by_source_type_clause:
                total_args.extend(filter_by_source_type)
            sql = f"""
                SELECT COUNT(*) as _total
                FROM websites_fts5
                LEFT JOIN websites ON websites.id = websites_fts5.website_id
                LEFT JOIN evaluations AS ev ON websites.id = ev.website_id
                {'WHERE websites_fts5 MATCH ?' if query else "WHERE 1=1"}
                {filter_by_scrape_clause}
                {filter_by_source_type_clause}
            """
            res = conn.execute(sql, total_args)
            total = res.fetchone()['_total']

        # Actual query
        sql = f"""
            SELECT 
            {website_cols_clause},
            COALESCE(wd.website_data, '[]') AS website_data,
            COALESCE(e.errors, '[]') AS errors,
            {eval_cols_clause}
            FROM websites_fts5
            LEFT JOIN websites ON websites.id = websites_fts5.website_id
            LEFT JOIN (
                SELECT 
                    website_id,
                    json_group_array(json_object('data_type', data_type, 'resource_id', resource_id)) AS website_data
                FROM website_data
                GROUP BY website_id
            ) AS wd ON websites.id = wd.website_id
            LEFT JOIN (
                SELECT 
                    website_id,
                    json_group_array(json_object('traceback', traceback, 'status', status, 'stage', stage, 'created_at', created_at)) AS errors
                FROM errors
                GROUP BY website_id
            ) AS e ON websites.id = e.website_id
            LEFT JOIN evaluations AS ev
                ON websites.id = ev.website_id
            {'WHERE websites_fts5 MATCH ?' if query else "WHERE 1=1"}
            {website_ids_clause}
            {filter_by_scrape_clause}
            {filter_by_source_type_clause}
            GROUP BY websites.id  -- Ensures one row per website
            ORDER BY websites.{order_by} {'DESC' if not asc else 'ASC'}, websites.url ASC
            LIMIT ? OFFSET ?
        """
        res = conn.execute(sql, query_args)
        results = res.fetchall()

    return results, total


@needs_db
def start_queue_job_if_none_exists(user: User, asset_id, db=None):
    # Check for job
    jobs = search_for_jobs(kind=SCRAPE_FROM_QUEUE_JOB, asset_id=asset_id, is_running=True, db=db)
    if len(jobs):
        return jobs[0]

    # Start new job
    job_id = start_job('scrape', {}, asset_id, SCRAPE_FROM_QUEUE_JOB, user_id=user.user_id, db=db)

    task_scrape_from_queue.apply_async(args=[user.to_json(), job_id, asset_id])


@needs_db
def add_websites_to_queue(user, asset_id, websites, db=None):
    MAX_QUEUE = 100
    queue, _ = get_asset_metadata(user, asset_id, keys=[SCRAPE_QUEUE], limit=MAX_QUEUE, get_total=False, db=db)

    # Is queue full?
    if len(queue) >= MAX_QUEUE:
        raise QueueFull()
    
    queued_ids = [str(ScrapeQueueItem(**json.loads(x['value'])).website_id) for x in queue]
    # Does site already exist in queue?
    for item in websites:
        if str(item['id']) in queued_ids:
            raise QueueDuplicate()
    
    values = [json.dumps(ScrapeQueueItem(website_id=item['id']).to_json()) for item in websites]
    add_bulk_asset_metadata(user, asset_id, key=SCRAPE_QUEUE, values=values, db=db)


@bp.route('/queue-manifest', methods=('GET',))
@cross_origin()
@token_optional
def queue_manifest(user: User):
    asset_id = request.args.get('id')
    asset_row = get_asset(user, asset_id)
    if not asset_row:
        return MyResponse(False, status=404, reason="Asset not found")
    
    limit = request.args.get('limit', 20)
    offset = request.args.get('offset', 0)
    
    metadata, total = get_asset_metadata(user, asset_id, keys=[SCRAPE_QUEUE], limit=limit, offset=offset, for_all_users=True)
    website_ids = [ScrapeQueueItem(**json.loads(x['value'])).website_id for x in metadata]
    sites, _ = search_sites(asset_id, website_ids=website_ids)

    return MyResponse(True, {'results': sites, 'total': total}).to_json()


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
    raw_query = request.args.get('query', "")
    order_by = request.args.get('order_by', None)
    asc = request.args.get('asc', '0') == '1'
    filter_by_scrape = request.args.getlist('quality')
    filter_by_source_type = request.args.getlist('source_type')

    results, total = search_sites(asset_id, raw_query, filter_by_scrape=filter_by_scrape, filter_by_source_type=filter_by_source_type, limit=limit, offset=offset, order_by=order_by, asc=asc)

    # Add info on which are queued
    if len(results):
        website_ids = [str(x['id']) for x in results]
        website_ids_str = ",".join(website_ids)
        sql = f"""
            SELECT * FROM asset_metadata
            WHERE `asset_id`=%s AND `key`=%s AND JSON_EXTRACT(`value`, '$.website_id') IN ({website_ids_str});
        """
        db = get_db()
        curr = db.cursor()
        curr.execute(sql, (asset_id, SCRAPE_QUEUE))
        queued = curr.fetchall()
        all_queued_ids = [ScrapeQueueItem(**json.loads(x['value'])).website_id for x in queued]
        all_queued_ids = [str(x) for x in all_queued_ids]
        # We love n^2 algorithms don't we folks?
        for res in results:
            if str(res['id']) in all_queued_ids:
                res['queued'] = True

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


@bp.route('/queue', methods=('POST',))
@cross_origin()
@token_optional
def queue_site(user: User):
    asset_id = request.json.get('id')
    asset_row = get_asset(user, asset_id)
    if not asset_row:
        return MyResponse(False, reason="Asset not found", status=404).to_json()
    
    item = request.json.get('item')
    try:
        add_websites_to_queue(user, asset_id, [item])
    except QueueDuplicate:
        return MyResponse(False, reason="Duplicate", status=409).to_json()  # 409 = Conflict
    except QueueFull:
        return MyResponse(False, reason="Queue full", status=429).to_json()  # 429 = "Too many requests"

    start_queue_job_if_none_exists(user, asset_id)

    return MyResponse(True).to_json()


@bp.route('/bulk-queue', methods=('POST',))
@cross_origin()
@token_optional
def bulk_queue_sites(user: User):
    asset_id = request.json.get('id')
    asset_row = get_asset(user, asset_id)
    if not asset_row:
        return MyResponse(False, reason="Asset not found", status=404).to_json()
    
    items = request.json.get('items')
    try:
        add_websites_to_queue(user, asset_id, items)
    except QueueDuplicate:
        return MyResponse(False, reason="Duplicate", status=409).to_json()  # 409 = Conflict
    except QueueFull:
        return MyResponse(False, reason="Queue full", status=429).to_json()  # 429 = "Too many requests"

    start_queue_job_if_none_exists(user, asset_id)

    return MyResponse(True).to_json()


@bp.route('/web', methods=('GET',))
@cross_origin()
@token_optional
def search_web(user: User):
    asset_id = request.args.get('id')
    asset_row = get_asset(user, asset_id)
    if not asset_row:
        return MyResponse(False, reason="No asset found", status=404).to_json()

    query = request.args.get('query')
    if not query:
        return MyResponse(True, {'results': [], 'total': 0}).to_json()
    
    limit = request.args.get('limit', 10, int)
    offset = request.args.get('offset', 0, int)

    # Use search engine
    se_code = get_user_search_engine_code(user)
    se: SearchEngine = SEARCH_PROVIDERS[se_code]
    results: list[SearchResult]
    results, total = se.search(query, max_n=limit, offset=offset)

    results_json = [x.to_json() for x in results]
    # Find which websites have already been added and return that with the results
    with CrawlerDB(asset_id, read_only=True) as crawler:
        quoted_urls = [f"'{x['url']}'" for x in results_json]
        sql = f"""
            SELECT * FROM websites
            WHERE `url` IN ({','.join(quoted_urls)})
        """
        res = crawler.execute(sql)
        duplicates = res.fetchall()

        # n^2 gang
        for item in duplicates:
            for i in range(len(results_json)):
                if results_json[i]['url'] == item['url']:
                    results_json[i]['added'] = True

    return MyResponse(True, {'results': results_json, 'total': total}).to_json()


@bp.route('/add-bulk', methods=('POST',))
@cross_origin()
@token_optional
def add_bulk(user: User):
    asset_id = request.json.get('id')
    asset_row = get_asset(user, asset_id)
    if not asset_row:
        return MyResponse(False, reason="Couldn't find asset", status=404).to_json()
    
    queue = request.json.get('queue', False)
    items = request.json.get('items')
    added = []
    with CrawlerDB(asset_id) as crawler:
        sql = """
            INSERT INTO websites (`url`, `title`)
            VALUES (?, ?)
        """
        for item in items:
            crawler.execute(sql, (item['url'], item['name']))
            get_id_sql = """
                SELECT * FROM websites
                WHERE rowid = last_insert_rowid();
            """
            res = crawler.execute(get_id_sql)
            last = res.fetchone()
            added.append(last)
        crawler.commit()

    if queue and len(added):
        try:
            add_websites_to_queue(user, asset_id, added)
        except QueueDuplicate:
            return MyResponse(False, reason="Duplicate", status=409).to_json()  # 409 = Conflict
        except QueueFull:
            return MyResponse(False, reason="Queue full", status=429).to_json()  # 429 = "Too many requests"

        start_queue_job_if_none_exists(user, asset_id)
        added = [{**x, 'queued': True} for x in added]
    
    return MyResponse(True, {'results': added}).to_json()


@bp.route('/create-asset', methods=('POST',))
@cross_origin()
@token_required
def create_asset_from_scrape(user: User):
    asset_id = request.json.get('id')
    asset_row = get_asset(user, asset_id)
    if not asset_row:
        return MyResponse(False, status=404, reason="Asset not found")

    website_id = request.json.get('website_id')
    resource_id = None
    website = None
    with CrawlerDB(asset_id, read_only=True) as crawler:
        sql = """
            SELECT * FROM websites WHERE `id`=?
        """
        res = crawler.execute(sql, (website_id,))
        website = res.fetchone()
        if not website:
            return MyResponse(False, reason="Website not found").to_json()
        sql = """
            SELECT * FROM website_data WHERE `website_id`=? AND `data_type`=?
        """
        res = crawler.execute(sql, (website_id, 'data'))
        website_data = res.fetchone()
        if not website_data:
            return MyResponse(False, reason="Website has no data").to_json()
        
        resource_id = website_data['resource_id']

    db = get_db(exclusive_conn=True)
    desc = "Website from Crawler"
    new_asset_id = None
    try:
        # Might want another function with logic or some other standard / better approach.
        template = 'website' if website['content_type'] == 'text/html' else 'document'
        ok, message = upload_asset(user, None, website['title'], desc, desc, template, asset_row['author'], None, db=db, no_commit=True)
        res = get_asset_resource_by_id(asset_id, resource_id)
        tmp = tempfile.NamedTemporaryFile(delete=False)
        if not ok:
            return MyResponse(False, reason=f"Couldn't create new asset: {message}").to_json()
        try:
            download_file(tmp.name, res)
            path, from_val = upload_asset_file(message, tmp.name, ext=get_extension_from_path(res['from'], res['path']))
            add_asset_resource(message, MAIN_FILE, from_val, path, website['title'], db=db, no_commit=True)
        finally:
            tmp.close()
            if os.path.exists(tmp.name):
                os.remove(tmp.name)
        db.commit()
        new_asset_id = message
        if template == 'website':
            insert_meta_url(new_asset_id, website['url'])
            insert_meta_author(new_asset_id, website['author'])
            insert_meta_description(new_asset_id, website['desc'])

        set_sources(user, asset_id, [new_asset_id], additive=True)
        
        with CrawlerDB(asset_id) as crawler:
            sql = """
                UPDATE websites SET `asset_id`=? WHERE `id`=?
            """
            crawler.execute(sql, (new_asset_id, website_id))
            crawler.commit()

    finally:
        db.close()

    return MyResponse(True, {'id': new_asset_id}).to_json()


@bp.route('/stats', methods=('GET',))
@cross_origin()
@token_optional
def stats(user: User):
    asset_id = request.args.get('id')
    asset_row = get_asset(user, asset_id)
    if not asset_row:
        return MyResponse(False, reason="Couldn't find asset", status=404).to_json()
    
    _, nqueued = get_asset_metadata(user, asset_id, keys=[SCRAPE_QUEUE], get_total=True)

    row = None
    with CrawlerDB(asset_id, read_only=True) as crawler:
        sql = """
            SELECT
            (SELECT COUNT(*) FROM websites WHERE scraped_at IS NOT NULL) AS scraped_count,
            (SELECT COUNT(*) FROM websites WHERE scraped_at IS NULL AND EXISTS (SELECT 1 FROM errors WHERE website_id = websites.id)) AS error_count,
            (SELECT COUNT(*) FROM websites) AS total_count;
        """
        res = crawler.execute(sql)
        row = res.fetchone()

    return MyResponse(True, {
        'queued': nqueued,
        'total': row['total_count'],
        'scraped': row['scraped_count'],
        'errors': row['error_count']
    }).to_json()


@bp.route('/suggest', methods=('POST',))
@cross_origin()
@token_optional
def suggest_questions(user: User):
    asset_id = request.json.get('id')
    asset_row = get_asset(user, asset_id)
    if not asset_row:
        return MyResponse(False, reason="Can't find asset").to_json()
    
    topic = request.json.get('topic')
    lm: LM = LM_PROVIDERS[HIGH_PERFORMANCE_CHAT_MODEL]
    sys_prompt = get_suggest_from_topic_system(n=10)
    resp = lm.run(topic, system_prompt=sys_prompt, make_json=True)
    try:
        obj = json.loads(resp)
        queries = obj['queries']
    except (ValueError, KeyError) as _:
        print(traceback.format_exc())
        print(f"LM generated crawler queries could not be parsed: {resp}", file=sys.stderr)
        return MyResponse(False, reason="LM failed").to_json()

    return MyResponse(True, {'results': queries}).to_json()


class Crawler(Template):
    def __init__(self) -> None:
        super().__init__()
        self.chattable = False
        self.summarizable = False
        self.code = "crawler"
        self.metadata_modify_with_edit_perm = [RESEARCH_TOPIC]

    @needs_db
    def upload(self, user: User, asset_id, asset_title="", using_auto_title=False, using_auto_desc=False, db=None):
        topic = request.form.get("topic")
        if topic:
            save_asset_metadata(user, asset_id, RESEARCH_TOPIC, topic)
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

    # We do NOT return the sqlite database
    def get_asset_resources(self, user, asset_id, exclude=[], db=None):
        return []

