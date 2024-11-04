from .configs.user_config import DEFAULT_STORAGE_OPTION
from .integrations.file_storage import FileStorage, FS_PROVIDERS
import requests
from datetime import datetime


# Returns 'path', 'from' values for a db entry
# If use_data is set, function uploads via bytes/string, not file path.
def upload_asset_file(asset_id, path, ext, use_data=None):
    if not ext:
        ext = "txt"
    if ext[0] == '.':
        ext = ext[1:]
    suggested_path = ['asset_' + str(asset_id), "asset_resources"]
    fs: FileStorage = FS_PROVIDERS[DEFAULT_STORAGE_OPTION]
    db_path = fs.upload_file(suggested_path, path, ext, use_data=use_data)
    return db_path, fs.code


def upload_retriever(resource_id, file_path, retriever_type_name):
    suggested_path = ["retriever_storage", str(resource_id['id']), retriever_type_name]
    fs: FileStorage = FS_PROVIDERS[DEFAULT_STORAGE_OPTION]
    db_path = fs.upload_file(suggested_path, file_path, "pkl")
    return db_path, fs.code


def upload_inter_asset_retriever(file_path):
    suggested_path = ["inter_asset_retriever_storage"]
    fs: FileStorage = FS_PROVIDERS[DEFAULT_STORAGE_OPTION]
    db_path = fs.upload_file(suggested_path, file_path, "pkl")
    return db_path, fs.code


def upload_media(file_path, ext):
    suggested_path = ["media_storage"]
    fs: FileStorage = FS_PROVIDERS[DEFAULT_STORAGE_OPTION]
    db_path = fs.upload_file(suggested_path, file_path, ext)
    return db_path, fs.code


def delete_resources(asset_resources):
    for res in asset_resources:
        fs: FileStorage = FS_PROVIDERS[res['from']]
        fs.delete_file(res['path'])


# Downloads file (from s3) into tempfile path file, set up by the user
# asset_resource is entry in asset_resources or asset_retrieval_sources or inter_asset_retrieval_storage row
def download_file(tempfile_path, asset_resource):
    fs: FileStorage = FS_PROVIDERS[asset_resource['from']]
    fs.download_file(tempfile_path, asset_resource['path'])


def download_file_from_url(tempfile_path, url):
    # Send a GET request to the URL
    response = requests.get(
        url,
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Referer': 'https://google.com'
        },
        stream=True
    )
    response.raise_for_status()  # Check if the request was successful

    # Open the destination file in write-binary mode
    with open(tempfile_path, 'wb') as file:
        # Write the response content to the file in chunks
        for chunk in response.iter_content(chunk_size=8192):
            if chunk:  # Filter out keep-alive new chunks
                file.write(chunk)


# Sometimes necessary to make a synthetic resource from metadata
# This should have all the columns in the asset_resources table. If that changes, this should change too.
def make_synthetic_resource(asset_id, title, text, time_uploaded=None, name='main'):
    if not time_uploaded:
        time_uploaded = datetime.now()
    return {
        'id': -1,
        'asset_id': asset_id,
        'name': name,
        'from': 'synthetic',
        'path': text,
        'time_uploaded': time_uploaded,
        'title': title
    }
