from .template import Template
import tempfile
from ..db import needs_db
from ..auth import User, token_required

class Deprecated(Template):
    chattable: bool = False
    code: str = 'deprecated' 
    make_retriever_on_upload: bool = False  # Need to be chattable and this true to make retriever on upload

    def __init__(self) -> None:
        pass

    # Returns a string for the language model prompt
    def build_chat_prompt(self, question, sources, extra_instructions="", src_title=""):
        return question

    def build_chat_system_prompt(self, question, sources, extra_instructions="", src_title="", source_names=None):
        return ""
    
    def build_detached_chat_system_prompt(self):
        return ""

    @needs_db
    def get_file(self, user, asset_id, only_headers=False, rec_calls=[], ret_resp=True, name="", db=None):
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".txt")
        return temp_file.name

    @needs_db
    def upload(self, user: User, asset_id, asset_title="", using_auto_title=False, using_auto_desc=False, db=None):
        return True, asset_id

    @needs_db
    def upload_file(self, user, file_obj, asset_id, asset_title="", resource_name="main", db=None):
        raise NotImplementedError("You can't upload a file to a deprecated template")

    @needs_db
    def get_asset_resources(self, user: User, asset_id, exclude=[], db=None):
        return []

    # Any extra delete cleanup that needs to be template specific
    def delete(self, curr, asset_manifest):
        pass

    @token_required
    def process_needs_attention_response(user: User, self, asset_metadata_row, data):
        raise NotImplementedError(f"Can't process needs attention response for template {self.code}")
