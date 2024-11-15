from unstructured.partition.xlsx import partition_xlsx
from unstructured.partition.docx import partition_docx
from unstructured.partition.html import partition_html
from unstructured.partition.auto import partition
import fitz
import json

# These integrations are DIFFERENT in pattern from the others.
# Each integration handles a different kind of file, rather than a different vendor

# An iterable of RawChunks is returned by load_and_split
# Unlike a Chunk, it's not processed / embedded - need to make into a chunk for retrieval.
class RawChunk():
    page_content: str
    metadata: dict
    def __init__(self, page_content, metadata={}):
        self.page_content = page_content
        self.metadata = metadata

"""

Takes string and returns list of strings

The algorithm:
- Split on the first separator
- Combine chunks in order if possible (i.e., resulting chunk isn't too big)
- Any chunks that are too big get the recursive split called on them again

Why a class instead of a function? Mostly just to match langchain behavior, or to specify args just once before passing same parametrized text splitter elsewhere, like in a retriever.

"""
class TextSplitter():
    def __init__(self, max_chunk_size, length_function=len, chunk_overlap=0):
        self.max_chunk_size = max_chunk_size
        self.length_function=length_function
        self.chunk_overlap = 0  # NOTE: doesn't yet support anything > 0 (in here for legacy langchain reasons)

    def split_text(self, txt, separators=None):

        DEFAULT_SEPARATORS = [  # the point of the weird character codes is to support multiple languages. Recommended here: https://python.langchain.com/v0.1/docs/modules/data_connection/document_transformers/recursive_text_splitter/
            "\n\n",
            "\n",
            " ",
            ".",
            ",",
            "\u200b",  # Zero-width space
            "\uff0c",  # Fullwidth comma
            "\u3001",  # Ideographic comma
            "\uff0e",  # Fullwidth full stop
            "\u3002",  # Ideographic full stop
        ]
        separators = separators if separators else DEFAULT_SEPARATORS

        def recursive_split(text, seps):
            max_chunks = []  # Holds chunks of their maximum size - not necessarily under max_chunk_size yet, though they'll never get bigger.

            sep = ""
            if not len(seps):
                # Means that some chunk is too big even after exhausting separators
                # Now just need to go in and dice it up without regard to separators
                splitsville = [text[:self.max_chunk_size], text[self.max_chunk_size:]]
            else:
                sep = seps[0]
                # Split on separator 
                splitsville = text.split(sep)

            # Max-combine chunks in order
            for split in splitsville:
                if not len(max_chunks):
                    max_chunks.append(split)
                elif self.length_function(max_chunks[len(max_chunks) - 1] + sep + split) < self.max_chunk_size:
                    max_chunks[len(max_chunks) - 1] += sep + split
                else:
                    max_chunks.append(split)

            # On any max_chunks that are not under max_chunk_size, split it again.
            final_chunks = []
            for max_chunk in max_chunks:
                if self.length_function(max_chunk) > self.max_chunk_size:
                    new_chunks = recursive_split(max_chunk, seps[1:])
                    final_chunks.extend(new_chunks)
                else:
                    final_chunks.append(max_chunk)
            
            return final_chunks
        
        if self.length_function(txt) <= self.max_chunk_size:
            return [txt]
        
        return recursive_split(txt, separators)


class FileLoader():
    def __init__(self, fname):
        self.fname = fname

    # Returns iterable of RawChunks
    def load_and_split(self, text_splitter: TextSplitter):
        raise NotImplementedError("Function load_and_split not implemented for some file loader.")


# "Unstructured" being the name of a package
class UnstructuredLoader(FileLoader):
    def load_and_split(self, text_splitter):
        # This corresponds to mode=single in langchain
        elements = self._get_elements()
        total = "\n\n".join([str(el) for el in elements])
        splitsville = text_splitter.split_text(total)
        for split in splitsville:
            yield RawChunk(split, {})
    
    # For different file types, returns iterable
    def _get_elements(self):
        raise NotImplementedError("Function _get_elements not implemented for some file loader.")


class ExcelLoader(UnstructuredLoader):
    def _get_elements(self):
        return partition_xlsx(filename=self.fname)


class DocxLoader(UnstructuredLoader):
    def _get_elements(self):
        return partition_docx(filename=self.fname, infer_table_structure=True)


class HTMLLoader(UnstructuredLoader):
    def _get_elements(self):
        return partition_html(filename=self.fname)

"""
# https://docs.unstructured.io/open-source/core-functionality/partitioning#partition
Contains information on what it supports - also, I removed the image extensions in auto_supports to make sure it doesn't try local OCR
"""
AUTO_SUPPORTS = ['docx', 'doc', 'odt', 'pptx', 'ppt', 'xlsx', 'csv', 'tsv', 'eml', 'msg', 'rtf', 'epub', 'html', 'xml', 'txt']
class AutoLoader(UnstructuredLoader):
    def _get_elements(self):
        return partition(filename=self.fname)


# Divides by page, and then splits within each page.
class PdfLoader(FileLoader):
    def load_and_split(self, text_splitter):
        doc = fitz.open(self.fname)
        for i, page in enumerate(doc): # iterate the document pages
            text = page.get_text()  # In the future, we should get images as well.
            split_text = text_splitter.split_text(text)
            for split in split_text:
                yield RawChunk(split, {'page': i})


# An AbbeyJson file is effectively: {"pages": [{"lines": ["...", ...]}, ...]}
class AbbeyJsonLoader(UnstructuredLoader):
    def load_and_split(self, text_splitter: TextSplitter):
        with open(self.fname, "r") as fhand:
            my_json = json.load(fhand)
            for i, page in enumerate(my_json['pages']):
                page_content = "\n".join(page['lines'])
                page_metadata = {'page': i}
                chunks = text_splitter.split_text(page_content)
                for chunk in chunks:
                    yield RawChunk(page_content=chunk, metadata=page_metadata)


class JsonLoader(FileLoader):
    def load_and_split(self, text_splitter):
        with open(self.fname, 'r') as file:
            original_contents = file.read()
        txt = "This is a JSON file:" + '\n' + original_contents
        splitsville = text_splitter.split_text(txt)
        for split in splitsville:
            yield RawChunk(split, {})


CODE_SUPPORTS = ['java', 'py', 'cpp', 'c', 'cs', 'js', 'ts', 'rs', 'swift', 'kt', 'm', 'scala', 'lua', 'sh', 'pl', 'sql', 'r']
class CodeLoader(FileLoader):
    def load_and_split(self, text_splitter: TextSplitter):
        all_code = ""
        with open(self.fname, 'r') as fhand:
            all_code = fhand.read()
        # TODO: use special text splitter for code.
        splits = text_splitter.split_text(all_code)
        for split in splits:
            yield RawChunk(page_content=split, metadata={})


def get_loader(filetype, path):
    if filetype == 'docx':
        return DocxLoader(path)
    elif filetype == 'xlsx': 
        return ExcelLoader(path)
    elif filetype in ['html', 'ahtml']:  # 'ahtml' is special "AbbeyHTML"
        return HTMLLoader(path)
    elif filetype == 'json':
        return JsonLoader(path)
    elif filetype == 'pdf':
        return PdfLoader(path)
    elif filetype == 'abbeyjson':
        return AbbeyJsonLoader(path)
    elif filetype in CODE_SUPPORTS:
        return CodeLoader(path)
    elif filetype in AUTO_SUPPORTS:
        return AutoLoader(path)
    return None
