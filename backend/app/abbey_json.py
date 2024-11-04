import json
from langchain.document_loaders import UnstructuredFileLoader

class SplitDataEntry:
    def __init__(self, metadata, page_content):
        self.metadata = metadata
        self.page_content = page_content


class AbbeyJsonFileLoader(UnstructuredFileLoader):
    def __init__(self, filename, *args, **kwargs):
        super().__init__(filename, *args, **kwargs)
        
    def load_content(self, filepath):
        with open(filepath, 'r') as file:
            content = file.read()
            data = json.loads(content)
            return self.transform_data(data)
    
    def transform_data(self, data):
        pages_data = []
        for i, page in enumerate(data.get('pages', [])):
            page_text = '\n'.join([line for line in page.get('lines', [])])
            pages_data.append({
                'page_content': page_text,
                'metadata': {'page': i}
            })
        return pages_data

    def load_and_split(self, text_splitter):
        data = self.load_content(self.file_path)
        split_data = []
        for page_data in data:
            page_content = page_data['page_content']
            page_metadata = page_data['metadata']
            chunks = text_splitter.split_text(page_content)
            for chunk in chunks:
                entry = SplitDataEntry(metadata=page_metadata, page_content=chunk)

                split_data.append(entry)
        return split_data
