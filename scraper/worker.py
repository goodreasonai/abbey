from celery import Celery
from playwright.sync_api import sync_playwright
import resource
import math
import tempfile
import os
from PIL import Image


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

    content_file_tmp = tempfile.NamedTemporaryFile(mode='w+', delete=False)
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
            context = browser.new_context(viewport={"width": BROWSER_WIDTH, "height": BROWSER_HEIGHT})
            
            page = context.new_page()

            # Set various security headers and limits
            page.set_default_timeout(30000)  # 30 second timeout
            page.set_default_navigation_timeout(30000)

            # Navigate to the page
            response = page.goto(url)
                    
            if not response or response.status >= 400:
                raise Exception(f"Failed to load page: Status {response.status if response else 'unknown'}")

            status = response.status
            headers = dict(response.headers)
            page.wait_for_timeout(wait)

            # Get total page height
            total_height = page.evaluate("""
                () => document.documentElement.scrollHeight
            """)

            # Calculate number of segments needed
            metadata['original_screenshots_n'] = math.ceil(total_height / BROWSER_HEIGHT)
            num_segments = min(metadata['original_screenshots_n'], MAX_SCREENSHOTS)
            metadata['truncated_screenshots_n'] = num_segments

            for i in range(num_segments):
                tmp = tempfile.NamedTemporaryFile(mode='w+b', delete=False)

                # Calculate current segment boundaries
                start_y = i * BROWSER_HEIGHT
                
                # Scroll to the current segment
                page.evaluate(f"""
                    window.scrollTo(0, {start_y})
                """)

                # Wait for any dynamic content to load
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
            
            # TODO might need to change up, especially for downloads
            content = page.content()
            content_file_tmp.write(content)

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
        except Exception as e:
            for css in compressed_screenshot_files:
                os.remove(css)
            content_file_tmp.close()
            os.remove(content_file)
            raise e
        finally:
            os.remove(ss)

    return status, headers, content_file, compressed_screenshot_files, metadata
