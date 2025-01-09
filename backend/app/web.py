import requests
from markdownify import MarkdownConverter
from bs4 import BeautifulSoup
from concurrent.futures import ThreadPoolExecutor, as_completed
from .retriever import Chunk
import re
from urllib.parse import urljoin
import sys
from .integrations.web import SearchEngine, SearchResult, SEARCH_PROVIDERS
from .integrations.file_loaders import get_loader, TextSplitter, RawChunk
from .user import get_user_search_engine_code
from .auth import User
from .utils import ntokens_to_nchars, get_token_estimate, get_mimetype_from_content_type_header, ext_from_mimetype
import tempfile
from .configs.settings import SETTINGS
from .configs.secrets import SCRAPER_API_KEY
from .exceptions import ScraperUnavailable
import json
from requests_toolbelt.multipart.decoder import MultipartDecoder


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


class ScrapeResponse():
    success: bool
    status: int
    url: str
    headers: dict
    data: bytes  # bytes!!!
    def __init__(self, success, status, url, headers, data=""):
        self.success = success
        self.status = status
        self.url = url
        self.headers = {str(k).lower(): v for k, v in headers.items()} if headers else {}
        self.data = data


class ScrapeMetadata():
    author: str
    desc: str
    title: str
    preview_image_url: str
    favicon_url: str
    def __init__(self, author="", desc="", title="", preview_image_url="", favicon_url=""):
        self.author = author
        self.desc = desc
        self.title = title
        self.preview_image_url = preview_image_url
        self.favicon_url = favicon_url


class CustomMarkdownConverter(MarkdownConverter):
    def convert(self, soup, strip=None):
        if strip is not None:
            for tag in strip:
                for element in soup.find_all(tag):
                    element.decompose()
            html = str(soup)
        return super().convert(html)
    
    def convert_iframe(self, el, text, convert_as_inline):
        # Extract the 'src' attribute from the iframe
        src = el.get('src')
        if src:
            return f'\n\n[Click to View Embedded Content]({src})\n\n'
        return ''
    
    def convert_pre(self, el, text, convert_as_inline):
        # Custom handling for <pre> tags
        return f'\n```\n{text}\n```\n'

    def convert_code(self, el, text, convert_as_inline):
        # Custom handling for <code> tags
        return f'`{text}`'


def get_metadata_from_scrape(scrape: ScrapeResponse):
    meta = ScrapeMetadata()
    if not scrape.success:
        return meta
    if 'content-type' not in scrape.headers:
        return meta
    if get_mimetype_from_content_type_header(scrape.headers['content-type']) != 'text/html':
        return meta
    
    soup = BeautifulSoup(scrape.data, 'html.parser')
    
    # TITLE: Get title if exists
    if soup.title.string:
        meta.title = soup.title.string

    # DESCRIPTION: Check the open graph description first, then meta description
    og_description = soup.find('meta', attrs={'property': 'og:description', 'content': True})
    if og_description:
        meta.desc = og_description['content']
    else:
        # Fallback to meta description
        meta_description = soup.find('meta', attrs={'name': 'description', 'content': True})
        if meta_description:
            meta.desc = meta_description['content']
    
    # AUTHOR: Check Open Graph author first
    og_author = soup.find('meta', attrs={'property': 'og:author', 'content': True})
    if og_author:
        meta.author = og_author['content']
    else:
        # Fallback to meta author if og:description not found
        meta_author = soup.find('meta', attrs={'name': 'author', 'content': True})
        if meta_author:
            meta.author = meta_author['content']

    # PREVIEW IMAGE
    og_image = soup.find('meta', attrs={'property': 'og:image', 'content': True})
    if og_image:
        meta.preview_image_url = og_image['content']
    else:
        # Fallback to Twitter image if og:image not found
        twitter_image = soup.find('meta', attrs={'name': 'twitter:image', 'content': True})
        if twitter_image:
            meta.preview_image_url = twitter_image['content']

    # FAVICON
    favicon = soup.find('link', rel=lambda x: x and x.lower() in ['icon', 'shortcut icon'])
    favicon_url = favicon['href'] if favicon and favicon.has_attr('href') else None
    if favicon_url:
        # Resolving the favicon URL against the base URL
        meta.favicon_url = urljoin(scrape.url, favicon_url)

    return meta


def scrape_with_requests(url, use_html=None, just_text=False, reduce_whitespace=False):
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

        return ScrapeResponse(True, status, url, resp_headers, data=website_data)

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

        status = None
        headers = None
        content = None
        for i, part in enumerate(decoder.parts):
            if i == 0:
                json_part = json.loads(part.content)
                status = json_part['status']
                headers = json_part['headers']
            if i == 1:
                content = part.content
        
        return ScrapeResponse(True, status, url, headers, content)
    except requests.RequestException as e:
        if e.response:
            status_code = e.response.status_code
            headers = e.response.headers
            my_json = None
            try:
                my_json = e.response.json()
                print(f"Error scraping: status={status_code}, error={my_json['error']}", file=sys.stderr)
            except:
                print(e, file=sys.stderr)

            return ScrapeResponse(False, status=status_code, url=url, headers=headers)
        else:
            return ScrapeResponse(False, status=None, url=url, headers={})



def get_web_chunks(user: User, search_query, available_context, max_n=5):
    se_code = get_user_search_engine_code(user)
    se: SearchEngine = SEARCH_PROVIDERS[se_code]
    results: list[SearchResult] = se.search(search_query)
    
    # Scrape each site in parallel
    scrape_responses = []
    with ThreadPoolExecutor(max_workers=10) as executor:
        future_to_search_result = {executor.submit(scrape_with_requests, result.url, just_text=True, reduce_whitespace=True): result for result in results}
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
            if scrape_result.data and 'content-type' in scrape_result.headers:
                mimetype = get_mimetype_from_content_type_header(scrape_result.headers['content-type'])
                ext = ext_from_mimetype(mimetype)
                if not ext:
                    continue

                # Use a slightly different strategy for making the chunk for html compared to other things
                if ext == 'html':
                    # Instead of simply truncating, we do the middle of the page, which is better for websites (nav bar + footer ...)
                    # Uses len for speed
                    soup = BeautifulSoup(scrape_result.data, 'html.parser')
                    text = soup.get_text()
                    truncate_chars = ntokens_to_nchars(per_source_max_tokens)
                    opening_i = max((len(text) // 2) - truncate_chars // 2, 0)
                    ending_i = truncate_chars + opening_i
                    text = text[opening_i:ending_i]
                else:
                    try:
                        tmp = tempfile.NamedTemporaryFile(delete=False)
                        tmp.write(scrape_result.data)
                        loader = get_loader(ext, tmp.name)
                        raw_chunks = loader.load_and_split(TextSplitter(max_chunk_size=ntokens_to_nchars(250), length_function=len))
                        for raw_chunk in raw_chunks:
                            raw_chunk: RawChunk
                            ntoks = get_token_estimate(raw_chunk.page_content)  # very accurate estimate
                            if cum_toks + ntoks > per_source_max_tokens:
                                break
                            text += raw_chunk.page_content
                            cum_toks += ntoks
                    finally:
                        tmp.close()
            else:
                continue
        else:
            continue
        
        url = scrape_result.url
        meta: ScrapeMetadata = get_metadata_from_scrape(scrape_result)
        image = meta.preview_image_url
        favicon = meta.favicon_url
        title = meta.title
        chunk = WebChunk(0, f"{title} ({url})", text, url, image=image, favicon=favicon)
        chunks.append(chunk)

    return chunks
