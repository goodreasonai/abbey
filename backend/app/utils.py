import string
import random
from datetime import datetime, timezone
import pickle
import tiktoken
from bs4 import BeautifulSoup
import pyheif  # type: ignore
from PIL import Image
from urllib.parse import urlparse
import re
import os
from urllib.parse import unquote


def get_unique_id():
    characters = string.ascii_letters + string.digits
    return ''.join(random.choice(characters) for _ in range(10))


# There's a frontend analog to this you should update as well (in utils fileResponse)
EXT_TO_MIMETYPE = {
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'txt': 'text/plain',
    'pdf': 'application/pdf',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'md': 'text/markdown',
    'epub': 'application/epub+zip',
    'html': 'text/html',
    'ahtml': 'abbey/html',
    'csv': 'text/csv'
}

def mimetype_from_ext(ext):
    if ext in EXT_TO_MIMETYPE:
        return EXT_TO_MIMETYPE[ext]
    else:
        return 'application/octet-stream'


def ext_from_mimetype(mimetype):
    inv_map = {v: k for k, v in EXT_TO_MIMETYPE.items()}
    if mimetype in inv_map:
        return inv_map[mimetype]
    else:
        return ""


def get_filename_from_headers(headers):
    if 'content-disposition' in headers:
        content_disposition = headers['content-disposition']
        match = re.search(r'filename="([^"]+)"', content_disposition, flags=re.IGNORECASE)
        filename = match.group(1) if match else None
        return filename
    return None


def get_mimetype_from_headers(headers):
    """
    1. If Content-Type is not 'application/octet-stream', trust it.
    2. Otherwise, look at Content-Disposition for filename; guess by extension.
    """

    if 'content-type' in headers:
        raw_content_type = headers['content-type'].lower()
        if not raw_content_type.startswith('application/octet-stream'):
            return raw_content_type.split(';', 1)[0].strip()

    # Step 2: Content-Disposition -> filename -> guess by extension
    filename = get_filename_from_headers(headers)
    if filename:
        _, ext = os.path.splitext(filename)
        ext = ext.lower().lstrip('.')  # e.g., "pdf"
        if ext in EXT_TO_MIMETYPE:
            return EXT_TO_MIMETYPE[ext]

    return None


# For a URL that returns a file with a particular extensions, tries to see if it get guess the name of the file
def guess_filename_from_url(url, extension):
    
    # Build a regex that looks for "someName.<extension>" 
    # followed by either the end of the string or a URL delimiter (&, ?, #).
    decoded_url = unquote(url)  # Handles special characters like %20
    pattern = re.compile(
        rf'([^/?#&]+\.{extension})(?=$|[?&#])',  # e.g. something.pdf(?=$|[?&#])
        re.IGNORECASE
    )
    match = pattern.search(decoded_url)
    return match.group(1) if match else None


# Returns without '.'
# from_key can be None, in which case it defaults to just find the thing after the .
def get_extension_from_path(from_key, path):
    if not path:
        return None
    
    if from_key == 'synthetic':
        return 'txt'
    
    last_segment = path.split("/")[-1]
    if "." not in last_segment:
        return ""

    return last_segment.split(".")[-1].lower()


def remove_ext(path):
    if not path:
        return None
    
    last_segment = path.split("/")[-1]
    if "." not in last_segment:
        return path
    return "".join(path.split(".")[:-1])


# A very rough estimate
def ntokens_to_nchars(toks):
    return toks * 4


def quick_tok_estimate(my_str):
    return len(my_str) // 4


tokenizer = tiktoken.get_encoding("gpt2")  # GPT2 tokenizer is also used for GPT-3, and maybe GPT-4?
def get_token_estimate(txt):
    tokens = tokenizer.encode(txt)
    return len(tokens)


def make_json_serializable(data):
    # Go through data recursively and convert datetimes to strings
    def rec(x):
        # Note: converts tuple to list
        if isinstance(x, list) or isinstance(x, tuple):
            return [rec(y) for y in x]
        elif isinstance(x, dict):
            return {rec(key): rec(val) for key, val in x.items()}
        elif isinstance(x, datetime):
            return x.strftime("%Y-%m-%d %H:%M:%S")
        else:
            return x

    new_data = rec(data)

    return new_data


# In truth, there is no way to do this. A valid email can be anything with an @ sign.
# However, here we verify that there is something before and after the @ sign as well
# You should only use this for determining whether to send an unnecessary email; for perfect verification, you'll need something else.
def is_valid_email(email: str):
    at_index = email.find('@')
    if at_index == -1 or at_index == 0 or len(email) - 1 == at_index:
        return False
    return True


class PickleWrapper:
    def __init__(self, data):
        self.pickled_data = pickle.dumps(data)

    def get_data(self):
        return pickle.loads(self.pickled_data)


# Deduplicates a list
def deduplicate(lst, key=lambda x:x):
    # Deduplicate asset resources as necessary
    existing = {}
    deduplicated = []
    for x in lst:
        if key(x) not in existing:
            existing[key(x)] = True
            deduplicated.append(x)
    return deduplicated


# Returns (image mimetype, base64 string)
def extract_from_base64_url(base64URL):
    # Expects base64URL to look like: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAy...
    splitsville = base64URL.split(';base64,')
    return splitsville[0][5:], splitsville[1]


def text_from_html(html_str):
    soup = BeautifulSoup(html_str, 'html.parser')
    text = soup.get_text(separator=' ', strip=True)
    return text


# In ISO string format
def get_current_utc_time():
    current_time_utc = datetime.now(timezone.utc)
    iso_time_utc = current_time_utc.isoformat()
    return iso_time_utc


# Compare timestamps of the type found in responses from the db
# returns 1 if t1 > t2; -1 if t2 > t1; and 0 if they're equal.
def compare_db_times(t1, t2):
    date1 = datetime.strptime(t1, "%Y-%m-%d %H:%M:%S")
    date2 = datetime.strptime(t2, "%Y-%m-%d %H:%M:%S")
    if date1 < date2:
        return -1
    elif date1 > date2:
        return 1
    else:
        return 0


# Turns seconds (in decimal) into minute:seconds format.
def format_seconds(decimal_seconds):
    # Round the total seconds to the nearest whole number
    total_seconds = round(decimal_seconds)

    # Calculate minutes and remaining seconds
    minutes = total_seconds // 60
    seconds = total_seconds % 60

    # Format the result as "minutes:seconds" with leading zero for seconds if needed
    formatted_time = f"{minutes}:{seconds:02}"

    return formatted_time


def convert_heic_to_jpg(heic_path, jpg_path):
    # Read HEIC file
    heif_file = pyheif.read(heic_path)
    
    # Convert HEIC to a PIL Image object
    image = Image.frombytes(
        heif_file.mode, 
        heif_file.size, 
        heif_file.data, 
        "raw", 
        heif_file.mode, 
        heif_file.stride,
    )

    # Save the image as a JPG file
    image.save(jpg_path, "JPEG")


# Some users incorrectly input their openai_compatible URLs; this fixes the common mistakes
def fix_openai_compatible_url(url):
    fixed_url = str(url)
    if not url:
        raise Exception("OpenAI Compatible URL is blank! Please enter one into your settings (refer to the README).")
    else:
        erroneous_suffixes = [
            '/v1/audio/speech/',
            '/v1/audio/speech',
            '/v1/embeddings/'
            '/v1/embeddings'
            '/v1/audio/',
            '/v1/audio',
            '/v1/',
            '/v1',
            '/'
        ]
        for suffix in erroneous_suffixes:
            if len(fixed_url) >= len(suffix):
                if fixed_url[-len(suffix):] == suffix:
                    fixed_url = fixed_url[:-len(suffix)]
        
        parsed_url = urlparse(fixed_url)
        if not parsed_url.path:  # If the URL doesn't have a path anymore, add /v1
            fixed_url += "/v1"
    # Add /v1 unless the URL is a 

    return fixed_url
