import os
import shutil
import boto3
from ..configs.secrets import AWS_ACCESS_KEY, AWS_SECRET_KEY
from ..configs.settings import SETTINGS
from ..utils import get_unique_id
import sys


class FileStorage():
    def __init__(self, code) -> None:
        self.code = code

    # Returns the remote path that can be used to download the file in the future.
    # The suggested path list is a way for the user of the fn to specify a suggested organization scheme (i.e., retrievers are given their own folder). It's given as a list, like ['asset_resources'] or ['asset_110', 'asset_resources']
    # ext does not come with a dot
    # If use_data is set, it means ignore the temp_path and upload the value of use_data as the data
    def upload_file(self, suggested_path_list, temp_path, ext, use_data=None):
        raise Exception(f"Upload file not implemented for file storage with code '{self.code}'")
    
    # tempfile_path = the path where you want to download the file to. remote_path = the path in the storage interface.
    def download_file(self, tempfile_path, remote_path):
        raise Exception(f"Download file not implemented for file storage with code '{self.code}'")

    def delete_file(self, remote_path):
        raise Exception(f"Delete file not implemented for file storage with code {self.code}")


class S3(FileStorage):
    def __init__(self, code):
        if 's3' not in SETTINGS['s3'] or 'bucket' not in SETTINGS['s3']['bucket']:
            print(f"Warning: s3 bucket not initialized; attempts to use s3 will fail. Refer to README for correct configuration.", file=sys.stderr)
        super().__init__(code)

    def upload_file(self, suggested_path_list, temp_path, ext, use_data=None):
        S3_BUCKET_NAME = SETTINGS['s3']['bucket']
        session = boto3.session.Session()
        s3 = session.client('s3', aws_access_key_id=AWS_ACCESS_KEY, aws_secret_access_key=AWS_SECRET_KEY)
        s3_id = get_unique_id()
        key = "/".join(suggested_path_list) + "/" + str(s3_id) + "." + ext
        if use_data is not None:
            s3.put_object(Bucket=S3_BUCKET_NAME, Key=key, Body=use_data)
        else:
            if not temp_path:
                raise Exception("No path specified to upload file from, and use_data not set.")
            s3.upload_file(temp_path, S3_BUCKET_NAME, key)
        db_path = S3_BUCKET_NAME + "/" + key
        return db_path

    def _get_bucket_and_key_from_path(self, path):
        path = path.split("/")
        bucket_name = path[0]
        key = "/".join(path[1:])
        return bucket_name, key

    def download_file(self, tempfile_path, remote_path):
        session = boto3.session.Session()
        s3 = session.client('s3', aws_access_key_id=AWS_ACCESS_KEY, aws_secret_access_key=AWS_SECRET_KEY)

        # Extract bucket and key from res['path']
        bucket_name, key = self._get_bucket_and_key_from_path(remote_path)

        # Open the temp file for writing
        with open(tempfile_path, 'wb') as f:
            try:
                # Initialize streaming of the S3 object
                s3_object = s3.get_object(Bucket=bucket_name, Key=key)
                streaming_body = s3_object['Body']
                
                # Read the file in chunks (e.g., 1024 bytes at a time)
                chunk_size = 1024
                for chunk in iter(lambda: streaming_body.read(chunk_size), b''):
                    f.write(chunk)
            except Exception as e:
                raise FileNotFoundError(f"Resource with path {remote_path} not found in {self.code}")

    def delete_file(self, remote_path):
        session = boto3.session.Session()
        s3 = session.client('s3', aws_access_key_id=AWS_ACCESS_KEY, aws_secret_access_key=AWS_SECRET_KEY)
        bucket, old_key = self._get_bucket_and_key_from_path(remote_path)
        try:
            s3.delete_object(Bucket=bucket, Key=old_key)
        except:  # Bad practice!
            # The assumption here is that it's already deleted for some reason
            print(f"Could not delete object {old_key}", file=sys.stderr)


class LocalStorage(FileStorage):

    def upload_file(self, suggested_path_list, temp_path, ext, use_data=None):
        from .. import LOCAL_STORAGE_PATH  # Avoiding global variable bugs
        
        # Create a unique ID for the file
        local_id = get_unique_id()
        
        # Construct the directory path and ensure it exists
        dir_path = os.path.join(LOCAL_STORAGE_PATH, *suggested_path_list)
        os.makedirs(dir_path, exist_ok=True)
        
        # Construct the full path for the file
        file_name = f"{local_id}.{ext}"
        file_path = os.path.join(dir_path, file_name)
        
        if use_data is not None:
            # Check if use_data is a string and encode it to bytes
            if isinstance(use_data, str):
                use_data = use_data.encode()  # Encode the string to bytes
            # Write the data directly to the file
            with open(file_path, 'wb') as f:
                f.write(use_data)
        else:
            if not temp_path:
                raise Exception("No path specified to upload file from, and use_data not set.")
            # Copy the file from the temp path to the destination
            shutil.copy(temp_path, file_path)
        
        # Return the relative path from the LOCAL_STORAGE_PATH
        return os.path.relpath(file_path, LOCAL_STORAGE_PATH)

    def download_file(self, tempfile_path, remote_path):
        from .. import LOCAL_STORAGE_PATH  # Avoiding global variable bugs
        local_path = os.path.join(LOCAL_STORAGE_PATH, remote_path)
        with open(local_path, 'rb') as fhand:
            with open(tempfile_path, 'wb') as temp_fhand:
                shutil.copyfileobj(fhand, temp_fhand)

    def delete_file(self, remote_path):
        from .. import LOCAL_STORAGE_PATH  # Avoiding global variable bugs
        file_path = os.path.join(LOCAL_STORAGE_PATH, remote_path)
        
        try:
            os.remove(file_path)
        except FileNotFoundError:
            # The file might have already been deleted or never existed
            print(f"File {file_path} not found, could not delete.", file=sys.stderr)
        except Exception as e:
            # Handle other potential exceptions
            print(f"Error deleting file {file_path}: {e}", file=sys.stderr)


# This is a special storage interface that lets data be transferred just in the "path"
# Basically, it's a hacky way to pretend as though some random text (like, a Workspace note) is actually a stored file when it is in fact stored in the database.
# Note that you cannot upload things to synthetic storage (it wouldn't go anywhere!)
class SyntheticStorage(FileStorage):

    def download_file(self, tempfile_path, remote_path):
        with open(tempfile_path, 'w') as fhand:
            fhand.write(remote_path)  # See that the "path" is actually the data itself.


PROVIDER_TO_FS = {
    's3': S3
}

def make_code_from_setting(fs):
    return fs['code'] if 'code' in fs else fs['provider']

"""
Settings look like:

storage:
  locations:
    - provider: s3

"""
def generate_fs():
    if 'storage' not in SETTINGS:
        return {}
    if 'locations' not in SETTINGS['storage'] or not len(SETTINGS['storage']['locations']):
        return {}
    
    to_return = {}
    options = SETTINGS['storage']['locations']
    for option in options:
        if 'disabled' in option and option['disabled']:
            continue
        provider = option['provider']
        provider_class = PROVIDER_TO_FS[provider]
        code = make_code_from_setting(option)
        obj = provider_class(
            code=code
        )
        to_return[code] = obj
    return to_return


FS_PROVIDERS = {
    **generate_fs(),
    'local': LocalStorage(code='local'),
    'synthetic': SyntheticStorage(code='synthetic')
}

def generate_default():
    first_option: FileStorage = [x for x in FS_PROVIDERS.values()][0]  # Is local if there's nothing specified
    if 'storage' not in SETTINGS:
        return first_option.code
    if 'locations' not in SETTINGS['storage'] or not len(SETTINGS['storage']['locations']):
        return first_option.code

    if 'default' in SETTINGS['storage']:
        return SETTINGS['storage']['default']

    return first_option.code  # Since there was something specified but no default, the first option is no longer local but something else.

DEFAULT_STORAGE_OPTION = generate_default()
