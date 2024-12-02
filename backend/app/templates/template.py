from abc import ABC

from ..auth import token_optional, get_permissioning_string, User, token_required

from ..template_response import MyResponse
from ..db import get_db, needs_db, ProxyDB
from ..utils import get_extension_from_path, mimetype_from_ext
from ..configs.str_constants import *
from ..template_response import response_from_resource
import tempfile
from ..storage_interface import download_file
from ..prompts.detached_chat_prompts import mixed_detached_chat_system_prompt
from ..asset_actions import get_asset
from ..retriever import Chunk
from ..utils import deduplicate
from ..prompts.prompt_fragments import get_basic_ai_identity, get_citation_prompt, get_web_citation_prompt
from ..prompts.prompt_fragments import has_page_numbers


# Template specific email rules for endpoints, permissions, etc.
class EmailRules():
    allowed_endpoints = []  # like ['reminder', ...] - see /email blueprint.

    needs_edit_permission_endpoints = []  # same - requires edit permission to use endpoint.
    def __init__(self) -> None:
        pass
    def get_email(self, user, asset_row, endpoint, data):
        raise NotImplementedError("get_email is not implemented for this template email rule.")
    
    @needs_db
    def schedule_emails(self, db: ProxyDB =None):  # called from email_process.
        return []

class Template(ABC):
    chattable: bool = False  # whether or not the /chat endpoint works
    summarizable: bool = False
    code: str = None  # e.g., "document" or "folder"
    
    metadata_modify_with_edit_perm: list = []  # which metadata keys can be modified in assets/save-metadata when the user has edit permissions
    metadata_hidden_wo_edit_perm: list = []  # which metadata keys cannot be viewed without edit permission

    metadata_user_specific: list = []  # which metadata keys can be viewed/modified, but only by that user (regardless of who owns the asset)
    # ^ user specific is combined with PROTECTED_METADATA_KEYS, which apply for all assets
    metadata_non_user_specific: list = []  # can override PROTECTED_METADATA_KEYS

    make_retriever_on_upload: bool = True  # Need to be chattable and this true to make retriever on upload

    # Allowed endpoints is like, ['reminder', ...] - see /email blueprint.
    # Allowed endpoints needs implemented associated functions (see class methods below)
    email_rules: EmailRules = EmailRules()

    def __init__(self) -> None:
        pass

    # Returns a string for the language model prompt
    def build_chat_prompt(self, question, sources, extra_instructions="", src_title=""):
        return question


    def build_web_chat_system_prompt(self, question, sources):
        prompt = f"{get_basic_ai_identity()}. A user is asking questions that may or may not be answered using excerpts from various web results. Below are those web results, which you just obtained by searching the user's question into a search engine."
        prompt += " Remember to BE CONCISE in your response. Also, if the selected web results or previous rounds of chat do not give the answer, then say so.\n"
        for source in sources:
            source: Chunk
            prompt += f"*EXCERPT from {source.source_name}*\n"
            prompt += source.txt
            prompt += "\n*END of EXCERPT*\n\n"
        prompt += get_web_citation_prompt()
        return prompt
    
    def build_quick_summary_system_prompt(self, chunks):
        preface = "Your task is to summarize concisely the user's source material. The user knows where it comes from; do not speculate on its source. Keep the most important information. Your resulting summary should be at most 2-3 paragraphs."
        chunk_text = ""
        for chunk in chunks:
            chunk: Chunk
            chunk_text += f"*START {chunk.source_name}*\n"
            chunk_text += chunk.txt
            chunk_text += "\n*END*\n\n"
        
        has_pns = has_page_numbers(chunks)
        cits = get_citation_prompt(include_warning=False, use_page_num_example=has_pns)

        return "\n\n".join([preface, chunk_text, cits])
    
    def build_key_points_system_prompt(self, chunks):
        # Should we cite page numbers or quotes
        has_pns = has_page_numbers(chunks)

        preface = """Your task is to turn a source into a few key takeaways. Your bullet points should be concise and in a short-hand, just as student's notes in a class may be similarly brief. Your response should be in a JSON format, conforming to the following schema:"""
        schema = """
        {
            "bullets": [
                {"text": "Your bullet point", "citations": ["Page numberOfPage1", "Page numberOfPage2"]},
                {"text": "Your second bullet point", "citations": ["Page numberOfPage3"]},
                ...
            ]
        }"""
        alt_schema = """
        {
            "bullets": [
                {"text": "Your bullet point", "citations": ["The hippopotamus is a semiaquatic mammal that...", "Notoriously, it can be quite aggressive."]},
                {"text": "Your second bullet point", "citations": ["What's surprising is that they are actually quite smart."]},
                ...
            ]
        }
        """
        end_beginning = "Here are parts of the original source:"
        chunk_text = ""
        for chunk in chunks:
            chunk: Chunk
            chunk_text += f"*START {chunk.source_name}*\n"
            chunk_text += chunk.txt
            chunk_text += "\n*END*\n\n"

        return "\n".join([preface, (schema if has_pns else alt_schema), end_beginning, chunk_text])


    def build_chat_system_prompt(self, question, sources, extra_instructions="", src_title="", source_names=None):
        if source_names:
            assert(len(source_names) == len(sources))

        prompt = f"{get_basic_ai_identity()} A user is asking questions related to a source. Below are parts of the source material."
        for i, source in enumerate(sources):
            source_name = ""
            if source_names:
                source_name = " " + source_names[i]

            prompt += f"*EXCERPT from {source_name}*\n"
            prompt += source
            prompt += f"\n*END of{' FINAL' if i == len(sources) - 1 else ''} EXCERPT*\n\n"

        prompt += "These excerpts may help you answer the user's question. Remember to BE CONCISE in your response.\n"
        prompt += get_citation_prompt()

        return prompt
    
    def build_detached_chat_system_prompt(self):
        return mixed_detached_chat_system_prompt()

    # ret_resp = return response; if false, returns temporary file path
    # Otherwise returns a response, used in the /files?id=[asset_id] endpoint
    # rec_calls is weird - for the case in a folder when a folder could have a copy of itself
    # so it keeps track of the "visited nodes"
    @needs_db
    def get_file(self, user, asset_id, only_headers=False, rec_calls=[], name=MAIN_FILE, ret_resp=True, db=None):

        curr = db.cursor()
        sql = f"SELECT * FROM asset_resources WHERE asset_id = %s AND name LIKE '{db.escape_string(name)}' ORDER BY `time_uploaded` DESC"
        curr.execute(sql, (asset_id,))
        res = curr.fetchone()
        if not res and ret_resp:
            response_status = 404 if name == MAIN_FILE else 204
            return MyResponse(False, reason=f"No files found for asset with id {asset_id}", status=response_status).to_json()
        elif not res:
            return None

        ext = get_extension_from_path(None, res['path'])
        mimetype = mimetype_from_ext(ext)
        
        if ret_resp:
            return response_from_resource(res, mimetype, filename=res['title']+ "." +ext, only_headers=only_headers)
        
        # Returning file path
        ext = get_extension_from_path(None, res['path'])
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix="."+ext)
        download_file(temp_file.name, res)
        return temp_file.name

    # Called after an asset has been added -
    # for asset_metadata and/or asset_resources
    # remember, could also be editing!
    @needs_db
    def upload(self, user: User, asset_id, is_editing, asset_title="", using_auto_title=False, using_auto_desc=False, db=None):
        return True, asset_id

    @needs_db
    def upload_file(self, user, file_obj, asset_id, asset_title="", resource_name="main", db=None):
        raise NotImplementedError("Not all templates can have an associated file")

    # Default implementation gets the asset's own asset resources
    # Permissioned
    # Returns list of asset_resources entries
    @needs_db
    def get_asset_resources(self, user: User, asset_id, exclude=[], db=None):  # exclude only relevant for asset retrieval sources
        curr = db.cursor()
        total_results = []
        permissioning_string = get_permissioning_string(user, db=db)

        sql = f"""
            WITH a as (
                SELECT asset_resources.*, assets.creator_id, assets.group_id
                FROM asset_resources
                JOIN assets ON asset_resources.asset_id = assets.id
                WHERE `asset_id` = %s AND `name` LIKE '{MAIN_FILE}'
            )
            SELECT DISTINCT a.* FROM a
            LEFT JOIN asset_permissions ap ON a.asset_id = ap.asset_id OR a.group_id = ap.group_id
            WHERE {permissioning_string}
            """

        curr.execute(sql, (asset_id,))
        res = curr.fetchall()
        total_results.extend(res)

        return total_results
    
    @needs_db
    def _get_asset_resources_include_retrieval_sources(self, user: User, asset_id, exclude=[], db=None):
        curr = db.cursor()
        total_results = []
        visited_asset_ids = list(exclude)

        def rec(x):
            visited_asset_ids.append(x)
            asset_row = get_asset(user, x)
            if asset_row:
                from .templates import get_template_by_code
                tmp: Template = get_template_by_code(asset_row['template'])
                resources = tmp.get_asset_resources(user, x, exclude=visited_asset_ids)
                total_results.extend(resources)


        sql = f"""
        SELECT * FROM asset_metadata
        WHERE `key` = '{RETRIEVAL_SOURCE}' AND `asset_id` = %s
        """
        curr.execute(sql, (asset_id,))

        results = curr.fetchall()

        if results:
            for meta in results:
                val = int(meta['value'])
                if val not in visited_asset_ids:
                    rec(val)
        
        # Deduplicate asset resources as necessary
        deduplicated = deduplicate(total_results, key=lambda x: x['id'])
        return deduplicated

    # Any extra delete cleanup that needs to be template specific
    def delete(self, curr, asset_manifest):
        pass

    @token_required
    def process_needs_attention_response(user: User, self, asset_metadata_row, data):
        raise NotImplementedError(f"Can't process needs attention response for template {self.code}")

    # When the collab namespace gets hit with an emit action
    def process_collab_action(self, user, asset_row, action_type, action_data):
        pass
