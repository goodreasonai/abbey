import requests
from bs4 import BeautifulSoup
from concurrent.futures import ThreadPoolExecutor, as_completed
from .retriever import Chunk
from urllib.parse import urljoin
import sys
from .integrations.web import SearchEngine, SearchResult, SEARCH_PROVIDERS
from .integrations.file_loaders import get_loader, TextSplitter, RawChunk
from .user import get_user_search_engine_code
from .auth import User
from .utils import ntokens_to_nchars, get_token_estimate, get_mimetype_from_headers, ext_from_mimetype, get_filename_from_headers, guess_filename_from_url, ext_from_mimetype
import tempfile
from .configs.settings import SETTINGS
from .configs.secrets import SCRAPER_API_KEY
from .exceptions import ScraperUnavailable
import json
from requests_toolbelt.multipart.decoder import MultipartDecoder
import os


class WebChunk(Chunk):
    url: str
    image: str
    favicon: str
    def __init__(self, index, source_name, txt, url, image="", favicon="", embedding=None) -> None:
        self.txt = txt
        self.url = url
        self.image = image
        self.favicon = favicon
        super().__init__(index, source_name, txt, embedding=embedding)
    
    def to_json(self):
        regular = super().to_json()
        regular['url'] = self.url
        if self.image:
            regular['image'] = self.image
        if self.favicon:
            regular['favicon'] = self.favicon
        return regular


class ScrapeMetadata():
    def __init__(self):
        self.author: str = ""
        self.desc: str = ""
        self.title: str = ""
        self.preview_image_url: str = ""
        self.favicon_url: str = ""
        self.content_type: str = ""


class ScrapeDataConsumer:
    def __init__(self, data_path):
        self.data_path = data_path

    def __enter__(self):
        # Returning the path to the data file
        return self.data_path

    def __exit__(self, exc_type, exc_value, traceback):
        # Remove the temporary file when done
        if os.path.exists(self.data_path):
            os.remove(self.data_path)


class ScrapeScreenshotConsumer:
    def __init__(self, data_paths, data_types):
        self.data_paths = data_paths
        self.data_types = data_types

    def __enter__(self):
        # Returning the path to the data file
        return self.data_paths, self.data_types

    def __exit__(self, exc_type, exc_value, traceback):
        # Remove the temporary file when done
        for path in self.data_paths:
            if os.path.exists(path):
                os.remove(path)


class ScrapeResponse():
    success: bool
    status: int
    url: str
    headers: dict
    data_path: str
    screenshot_paths: list
    screenshot_mimetypes: list
    metadata: ScrapeMetadata
    def __init__(self, success, status, url, headers):
        self.success = success
        self.status = status
        self.url = url
        self.screenshot_paths = []
        self.screenshot_mimetypes = []
        self.headers = {str(k).lower(): v for k, v in headers.items()} if headers else {}
        self._determine_content_type()
        self.data_path = None

    def _determine_content_type(self):
        meta = ScrapeMetadata()
        meta.content_type = get_mimetype_from_headers(self.headers)
        if meta.content_type != 'text/html':
            filename = get_filename_from_headers(self.headers)
            if filename:
                meta.title = filename
            else:
                ext = ext_from_mimetype(meta.content_type)
                if ext:
                    meta.title = guess_filename_from_url(self.url, ext)
        self.metadata = meta

    def _set_metadata_from_html(self, content):
        soup = BeautifulSoup(content, 'html.parser')

        # TITLE: Get title if exists
        if soup.title.string:
            self.metadata.title = soup.title.string

        # DESCRIPTION: Check the open graph description first, then meta description
        og_description = soup.find('meta', attrs={'property': 'og:description', 'content': True})
        if og_description:
            self.metadata.desc = og_description['content']
        else:
            # Fallback to meta description
            meta_description = soup.find('meta', attrs={'name': 'description', 'content': True})
            if meta_description:
                self.metadata.desc = meta_description['content']
        
        # AUTHOR: Check Open Graph author first
        og_author = soup.find('meta', attrs={'property': 'og:author', 'content': True})
        if og_author:
            self.metadata.author = og_author['content']
        else:
            # Fallback to meta author if og:description not found
            meta_author = soup.find('meta', attrs={'name': 'author', 'content': True})
            if meta_author:
                self.metadata.author = meta_author['content']

        # PREVIEW IMAGE
        og_image = soup.find('meta', attrs={'property': 'og:image', 'content': True})
        if og_image:
            self.metadata.preview_image_url = og_image['content']
        else:
            # Fallback to Twitter image if og:image not found
            twitter_image = soup.find('meta', attrs={'name': 'twitter:image', 'content': True})
            if twitter_image:
                self.metadata.preview_image_url = twitter_image['content']

        # FAVICON
        favicon = soup.find('link', rel=lambda x: x and x.lower() in ['icon', 'shortcut icon'])
        favicon_url = favicon['href'] if favicon and favicon.has_attr('href') else None
        if favicon_url:
            # Resolving the favicon URL against the base URL
            self.metadata.favicon_url = urljoin(self.url, favicon_url)

    def set_data(self, content):
        try:
            if self.metadata.content_type == 'text/html':
                self._set_metadata_from_html(content)
            tmp = tempfile.NamedTemporaryFile(delete=False)
            tmp.write(content)
            self.data_path = tmp.name
        finally:
            tmp.close()

    def add_screenshot(self, content, mimetype):
        try:
            tmp = tempfile.NamedTemporaryFile(delete=False)
            tmp.write(content)
            self.screenshot_paths.append(tmp.name)
            self.screenshot_mimetypes.append(mimetype)
        finally:
            tmp.close()

    def consume_data(self):
        # Designed to be used like...
        # with scrape.consume_data() as data_path:
        #     # ... do stuff with data_path
        # And removes the file when done.
        if not self.data_path:
            raise Exception("There is no scraped data")
        curr_data_path = self.data_path
        self.data_path = None
        return ScrapeDataConsumer(curr_data_path)
    
    def consume_screenshots(self):
        if not len(self.screenshot_paths):
            return []
        these_paths = list(self.screenshot_paths)
        these_types = list(self.screenshot_mimetypes)
        self.screenshot_paths = []
        self.screenshot_mimetypes = []
        return ScrapeScreenshotConsumer(these_paths, these_types)

    def __del__(self):
        # Ensure the temporary file is deleted when the object is destroyed
        try:
            if self.data_path and os.path.exists(self.data_path):
                print(f"Scrape response data being removed in garbage collection; this is a sign of buggy code. Scraped URL was '{self.url}'.")
                os.remove(self.data_path)
            if len(self.screenshot_paths):
                print(f"Scrape response screnshots being removed in garbage collection; this is a sign of buggy code. Scraped URL was '{self.url}'.")
                for ss in self.screenshot_paths:
                    if os.path.exists(ss):
                        os.remove(ss)
        except Exception as e:
            print(f"Error cleaning up ScrapeResponse for '{self.url}' during object deletion: {e}")


def scrape_with_requests(url, use_html=None):
    try:
        if not use_html:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3',
                'Accept': 'application/json, text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9'
            }
            response = requests.get(url, headers=headers, timeout=5)
            response.raise_for_status()  # will throw an error if the request isn't good
            status = response.status_code
            website_data = response.content
            resp_headers = response.headers
        else:
            website_data = use_html.encode('utf-8')
            resp_headers = {'content-type': 'text/html'}

        resp = ScrapeResponse(True, status, url, resp_headers)
        resp.set_data(website_data)
        return resp

    except requests.RequestException as e:
        print(e, file=sys.stderr)
        if e.response:
            status_code = e.response.status_code
            headers = e.response.headers
            return ScrapeResponse(False, status=status_code, url=url, headers=headers)
        else:
            return ScrapeResponse(False, status=None, url=url, headers={})


def scrape_with_service(url):
    if 'scraper'  not in SETTINGS:
        raise ScraperUnavailable()

    scraper_url = "http://scraper:5006"  # default url
    if SETTINGS['scraper'] and 'url' in SETTINGS['scraper']:
        scraper_url = SETTINGS['scraper']['url']
    headers = {
        'Authorization': f'Bearer {SCRAPER_API_KEY}'
    }
    data = {
        'url': url
    }
    try:
        response = requests.post(scraper_url + '/scrape', json=data, headers=headers, timeout=30)
        response.raise_for_status()
        decoder = MultipartDecoder.from_response(response)

        resp = None
        for i, part in enumerate(decoder.parts):
            if i == 0:  # First is some JSON
                json_part = json.loads(part.content)
                status = json_part['status']
                headers = json_part['headers']
                resp = ScrapeResponse(False, status, url, headers)
            elif i == 1:  # Next is the actual content of the
                if part.content:
                    resp.success = True
                    resp.set_data(part.content)
            else:  # Other parts are screenshots, if they exist
                # Annoyingly the headers are bytes not strings for some reason
                mimetype: bytes = part.headers[b'Content-Type']
                mimetype: str = mimetype.decode()
                resp.add_screenshot(part.content, mimetype)
        
        return resp

    except requests.RequestException as e:
        if e.response:
            try:
                my_json = e.response.json()
                message = my_json['error']
                print(f"Error scraping: {message}", file=sys.stderr)
            except:
                print(e, file=sys.stderr)
        return ScrapeResponse(False, status=None, url=url, headers={})


def get_web_chunks(user: User, search_query, available_context, max_n=5):
    se_code = get_user_search_engine_code(user)
    se: SearchEngine = SEARCH_PROVIDERS[se_code]
    results: list[SearchResult]
    results, _ = se.search(search_query)
    
    # Scrape each site in parallel
    scrape_responses = []
    with ThreadPoolExecutor(max_workers=10) as executor:
        future_to_search_result = {executor.submit(scrape_with_requests, result.url): result for result in results}
        for future in as_completed(future_to_search_result):
            res = future_to_search_result[future]
            try:
                data: ScrapeResponse = future.result()
                if data:
                    scrape_responses.append(data)
            except Exception as exc:
                print('Exception in get_web_chunks: %r generated an exception: %s' % (res.url, exc))
    
    scrape_responses = scrape_responses[:max_n]
    
    if not len(scrape_responses):
        return []
    
    per_source_max_tokens = available_context // len(scrape_responses)

    # Process and divide each source
    chunks = []
    for scrape_result in scrape_responses:
        scrape_result: ScrapeResponse
        text = ""
        if scrape_result.success:
            with scrape_result.consume_data() as data_path:
                # Use a slightly different strategy for making the chunk for html compared to other things
                if scrape_result.metadata.content_type == 'text/html':
                    data = None
                    with open(data_path, 'r') as fhand:
                        data = fhand.read()
                    # Instead of simply truncating, we do the middle of the page, which is better for websites (nav bar + footer ...)
                    # Uses len for speed
                    soup = BeautifulSoup(data, 'html.parser')
                    text = soup.get_text()
                    truncate_chars = ntokens_to_nchars(per_source_max_tokens)
                    opening_i = max((len(text) // 2) - truncate_chars // 2, 0)
                    ending_i = truncate_chars + opening_i
                    text = text[opening_i:ending_i]
                else:
                    cum_toks = 0
                    loader = get_loader(ext_from_mimetype(scrape_result.metadata.content_type), data_path)
                    raw_chunks = loader.load_and_split(TextSplitter(max_chunk_size=ntokens_to_nchars(250), length_function=len))
                    for raw_chunk in raw_chunks:
                        raw_chunk: RawChunk
                        ntoks = get_token_estimate(raw_chunk.page_content)  # very accurate estimate
                        if cum_toks + ntoks > per_source_max_tokens:
                            break
                        text += raw_chunk.page_content
                        cum_toks += ntoks
        else:
            continue
        
        url = scrape_result.url
        meta: ScrapeMetadata = scrape_result.metadata
        image = meta.preview_image_url
        favicon = meta.favicon_url
        title = meta.title
        chunk = WebChunk(0, f"{title} ({url})", text, url, image=image, favicon=favicon)
        chunks.append(chunk)

    return chunks
