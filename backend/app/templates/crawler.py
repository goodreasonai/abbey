from .template import Template
from ..db import needs_db
from ..auth import User
import sqlite3
import tempfile
import os
from ..asset_actions import add_asset_resource, upload_asset_file
from ..configs.str_constants import MAIN_FILE


def create_and_upload_database(asset_id):
    temp_file = tempfile.NamedTemporaryFile(mode='w+', delete=False)
    db_path = temp_file.name
    try:
        # Connect to the SQLite database
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        sql = """
            CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                scraped_at DATETIME,      
                title TEXT,
                author TEXT,
                url TEXT
            )
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
