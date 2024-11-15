from ..exceptions import PdfTooLongError
from ..configs.user_config import MAX_PDF_PAGES
from ..db import needs_db
from ..template_response import MyResponse
from flask import (
    request,
    Blueprint,
)
from ..storage_interface import upload_asset_file
from ..utils import get_extension_from_path
from ..configs.str_constants import *
from .template import Template
from ..auth import User, token_required
from flask_cors import cross_origin
import tempfile
import os
import json
import fitz
from ..asset_actions import get_asset, replace_asset_resource, add_asset_resource
from ..configs.str_constants import MAIN_FILE
from ..prompts.prompt_fragments import get_basic_ai_identity, get_citation_prompt

bp = Blueprint('document', __name__, url_prefix="/document")

DISALLOWED_DOC_EXTENTIONS = ['pages', 'key', 'mp4', 'mov', 'mpeg', 'flv', 'ico']

@bp.route('/save-markdown', methods=('POST',))
@cross_origin()
@token_required
def save_file(user: User):

    id = request.json.get("id")
    data = request.json.get('data')
    res = get_asset(user, id, needs_edit_permission=True)

    if not res:
        return MyResponse(False, reason="No asset found", status=404).to_json()

    asset_id = res['id']
    asset_title = res['title']

    path, from_key = upload_asset_file(asset_id, None, 'md', use_data=data)
    replace_asset_resource(asset_id, MAIN_FILE, from_key, path, asset_title)

    return MyResponse(True, { 'data': data }).to_json()
    


class Document(Template):
    def __init__(self) -> None:
        super().__init__()
        self.code = "document"
        self.summarizable = True
        self.chattable = True

    def build_chat_system_prompt(self, question, sources, extra_instructions="", src_title="", source_names=None):
        if source_names:
            assert(len(source_names) == len(sources))

        prompt = f"{get_basic_ai_identity()} A user is asking questions related to a document. Below are parts of the document."
        
        for i, source in enumerate(sources):
            source_name = ""
            if source_names:
                source_name = " " + source_names[i]

            prompt += f"*EXCERPT from {source_name}*\n"
            prompt += source
            prompt += f"\n*END of{' FINAL' if i == len(sources) - 1 else ''} EXCERPT*\n\n"

        prompt += "These excerpts may help you answer the user's question. Remember to BE CONCISE in your response.\n"
        has_pns = len(source_names) and source_names[0].lower().find('page ') != -1

        prompt += get_citation_prompt(use_page_num_example=has_pns)

        return prompt

    @needs_db
    def upload(self, user: User, asset_id, is_editing, asset_title="", using_auto_title=False, using_auto_desc=False, db=None):
        
        PDF_TOO_LONG_ERROR = "Pdf too long"  # Must match frontend
        
        # No file, but we're editing, so don't delete existing file
        # There's nothing to do atm!
        if is_editing and (not request.files or not request.files.get('files')):
            pass
        elif (not request.files or not request.files.get('files')):
            # Create a blank markdown file
            path, from_key = upload_asset_file(asset_id, None, 'md', use_data="Edit me")
            add_asset_resource(asset_id, MAIN_FILE, from_key, path, asset_title, db=db, no_commit=True)
        else:
            try:
                pages = request.form.get('pdf_pages')
                if pages:
                    parsed = json.loads(pages)
                    from_page = 0
                    to_page = -1

                    if parsed[0]:
                        from_page = int(parsed[0])
                    if parsed[1]:
                        to_page = int(parsed[1])
                    pages = [from_page, to_page]

                fname = request.files.get('files').filename
                if fname:
                    try:
                        ext = get_extension_from_path(None, fname)
                        if ext in DISALLOWED_DOC_EXTENTIONS:
                            return False, f"{ext.upper()} files are not allowed in Document."
                    except:  # 
                        print(f"Couldn't get extension for {fname}")

                self.upload_file(user, request.files.get('files'), asset_id, asset_title=asset_title, pages=pages, db=db)
            except PdfTooLongError:
                return False, PDF_TOO_LONG_ERROR
        
        return True, ""


    @needs_db
    def upload_file(self, user, file_obj, asset_id, asset_title="", resource_name=MAIN_FILE, pages=None, db=None):
        name = file_obj.filename
        if not name:
            name = "File.txt"

        with tempfile.NamedTemporaryFile(delete=False) as temp:
            file_obj.save(temp.name)
        
        ext = get_extension_from_path(None, name)  # From doesn't really matter except for synthetic

        # PDF page length limits
        try:
            if ext == 'pdf':

                pdf_doc = fitz.open(temp.name)
                npages = len(pdf_doc)

                if pages:
                    if pages[1] < 0:
                        pages[1] = npages - pages[1]

                    if pages[0] < 1:
                        pages[0] = 1

                    # Technically .insert_pdf handles these cases, but they could cause us to miscalculate npages
                    # So we define our own behavior. Users shouldn't do it!
                    if pages[1] > npages:
                        pages[1] = npages
                    
                    if pages[0] > npages:
                        pages[0] = npages

                    if pages[1] < pages[0]:
                        pages[0] = pages[1]

                    # If pages are specified, split up the doc
                    new_pdf = fitz.open()  # Create a new empty PDF
                    new_pdf.insert_pdf(pdf_doc, from_page=pages[0]-1, to_page=pages[1]-1)
                    npages = pages[1] - pages[0] + 1

                    new_pdf.save(temp.name)
                    new_pdf.close()

                pdf_doc.close()

                if npages > MAX_PDF_PAGES:
                    raise PdfTooLongError()

            path, from_key = upload_asset_file(asset_id, temp.name, ext)
        
        finally:
            os.remove(temp.name)

        # Do main asset_resources already exist for this asset?
        # If so, get rid of them and replace with the new one
        replace_asset_resource(asset_id, resource_name, from_key, path, asset_title, db=db)
