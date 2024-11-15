from unstructured.partition.xlsx import partition_xlsx
from unstructured.partition.docx import partition_docx

# These integrations are DIFFERENT in pattern from the others.
# Each integration handles a different kind of file, rather than a different vendor

# An iterable of Pages is returned by load_and_split
class Page():
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
    def __init__(self, max_chunk_size, separators=["\n\n", "\n", " "], length_function=len, chunk_overlap=0):
        self.max_chunk_size = max_chunk_size
        self.separators = separators
        self.length_function=length_function
        self.chunk_overlap = 0  # NOTE: doesn't yet support anything > 0 (in here for legacy langchain reasons)

    def split_text(self, txt):

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
        
        return recursive_split(txt, self.separators)


class FileLoader():
    def __init__(self, fname):
        self.fname = fname

    def load_and_split(self, text_splitter: TextSplitter):
        # This corresponds to mode=single in langchain
        elements = self._get_elements()
        total = "\n\n".join([str(el) for el in elements])
        splitsville = text_splitter.split_text(total)
        for split in splitsville:
            yield Page(split, {})

    # For different file types, returns iterable
    def _get_elements():
        raise NotImplementedError("Function _get_elements not implemented for some file loader.")


class ExcelLoader(FileLoader):
    def _get_elements(self):
        return partition_xlsx(filename=self.fname)


class DocxLoader(FileLoader):
    def _get_elements(self):
        return partition_docx(filename=self.fname)

