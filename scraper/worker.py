from celery import Celery
from playwright.sync_api import sync_playwright, Error as PlaywrightError
import resource
import math
import tempfile
import os
from PIL import Image
import sys


MEM_LIMIT_MB = 4_000  # 4 GB memory threshold for child scraping process
MAX_SCREENSHOTS = 5
SCREENSHOT_JPEG_QUALITY = 85

CELERY_RESULT_BACKEND = "redis://localhost:6379/0"
CELERY_BROKER_URL = "redis://localhost:6379/0"

def make_celery():
    celery = Celery(
        backend=CELERY_RESULT_BACKEND,
        broker=CELERY_BROKER_URL
    )
    celery.conf.update(
        worker_concurrency=3,  # Limit number of concurrent tasks
    )

    return celery

celery = make_celery()

@celery.task
def scrape_task(url, wait):

    # Memory limits for the task process
    soft, hard = (MEM_LIMIT_MB * 1024 * 1024, MEM_LIMIT_MB * 1024 * 1024)
    resource.setrlimit(resource.RLIMIT_AS, (soft, hard))  # Browser should inherit this limit

    content_file_tmp = tempfile.NamedTemporaryFile(mode='w+b', delete=False)
    content_file = content_file_tmp.name

    raw_screenshot_files = []
    metadata = {
        'image_sizes': [],
        'original_screenshots_n': 0,
        'truncated_screenshots_n': 0,
    }
    status = None
    headers = None
    try:
        with sync_playwright() as p:
            # Should be resilient to untrusted websites
            browser = p.firefox.launch(headless=True, timeout=10_000)  # 10s startup timeout
            BROWSER_HEIGHT = 2000
            BROWSER_WIDTH = 1280
            context = browser.new_context(viewport={"width": BROWSER_WIDTH, "height": BROWSER_HEIGHT}, accept_downloads=True)
            
            page = context.new_page()

            # Set various security headers and limits
            page.set_default_timeout(30000)  # 30 second timeout
            page.set_default_navigation_timeout(30000)

            processing_download = False

            # Handle response will work even if goto fails (i.e., for download).
            response = None
            def handle_response(_response):
                nonlocal response
                # Check if it's the main resource
                if _response.url == url:
                    response = _response

            page.on("response", handle_response)

            # Navigate to the page
            # If there's no download, screenshotting and request stuff proceeds as normal
            # If a download is initiated, Playwright throws an error which you can then handle
            try:
                response = page.goto(url)
            except PlaywrightError as e:
                # Unfortunately, a specific error isn't thrown - have to use the substring
                substr = "Download is starting"
                if substr in str(e):
                    # If I use this around the first response, a timeout will occur when there's no download.
                    # But there's still the same exception to handle even with the expect download... playwright can be hell sometimes
                    with page.expect_download() as download_info:  
                        try:
                            page.goto(url)
                        except PlaywrightError as e:
                            if substr in str(e):
                                processing_download = True
                                download = download_info.value
                                download.save_as(content_file_tmp.name)
                                # Note that this "response" isn't the one assigned in the try;
                                # It's the one from handle_response
                                status = response.status
                                headers = response.headers
                            else:
                                raise e
                else:
                    raise e

            if not response or response.status >= 400:
                raise Exception(f"Failed to load page: Status {response.status if response else 'unknown'}")

            if not processing_download:
                status = response.status
                headers = dict(response.headers)
                content_type = headers.get("content-type", "").lower()

                # If this is an HTML page, take screenshots
                if "text/html" in content_type:
                    page.wait_for_timeout(wait)
                    
                    # Get total page height
                    total_height = page.evaluate("() => document.documentElement.scrollHeight")

                    # Calculate number of segments needed
                    metadata['original_screenshots_n'] = math.ceil(total_height / BROWSER_HEIGHT)
                    num_segments = min(metadata['original_screenshots_n'], MAX_SCREENSHOTS)
                    metadata['truncated_screenshots_n'] = num_segments

                    raw_screenshot_files = []
                    
                    for i in range(num_segments):
                        tmp = tempfile.NamedTemporaryFile(mode='w+b', delete=False)
                        
                        start_y = i * BROWSER_HEIGHT
                        page.evaluate(f"window.scrollTo(0, {start_y})")
                        page.wait_for_timeout(wait)

                        page.screenshot(
                            path=tmp.name,
                            animations="disabled",
                            clip={
                                "x": 0,
                                "y": 0,
                                "width": BROWSER_WIDTH,
                                "height": BROWSER_HEIGHT
                            }
                        )
                        
                        raw_screenshot_files.append(tmp.name)
                        tmp.close()
                
                # If not text/html, just retrieve the raw bytes
                # Note that if not text/html, might've been caught by the download stuff above
                file_bytes = response.body()
                content_file_tmp.write(file_bytes)
                browser.close()

    except Exception as e:
        for ss in raw_screenshot_files:
            os.remove(ss)
        content_file_tmp.close()
        os.remove(content_file)
        raise e
    
    # Compress the screenshot files
    compressed_screenshot_files = []
    for ss in raw_screenshot_files:
        try:
            tmp = tempfile.NamedTemporaryFile(mode='w+b', delete=False)
            o_size = os.path.getsize(ss)
            with Image.open(ss) as img:
                if img.mode == 'RGBA':  # Will throw an error unless converted
                    img = img.convert('RGB')
                img.save(tmp.name, 'JPEG', quality=SCREENSHOT_JPEG_QUALITY)                
            c_size = os.path.getsize(tmp.name)
            metadata['image_sizes'] = {
                'original': o_size,
                'compressed': c_size
            }
            compressed_screenshot_files.append(tmp.name)
        except Exception as e:
            for css in compressed_screenshot_files:
                os.remove(css)
            content_file_tmp.close()
            os.remove(content_file)
            raise e
        finally:
            os.remove(ss)

    print(f"Number of screenshot files: {len(compressed_screenshot_files)}", file=sys.stderr)

    return status, headers, content_file, compressed_screenshot_files, metadata
