from celery import Celery
from playwright.sync_api import sync_playwright
import resource
import math
import tempfile
import os
import sys


MAX_RESOURCE_SIZE_MB = 1_000  # 1 GB threshold for requests while scraping
MEM_LIMIT_MB = 4_000  # 3 GB memory threshold for child scraping process

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

    soft, hard = (MEM_LIMIT_MB * 1024 * 1024, MEM_LIMIT_MB * 1024 * 1024)
    resource.setrlimit(resource.RLIMIT_AS, (soft, hard))  # Browser should inherit this limit

    screenshot_files = []

    try:
        html = None
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

            page.wait_for_timeout(wait)

            # Get total page height
            total_height = page.evaluate("""
                () => document.documentElement.scrollHeight
            """)

            # Calculate number of segments needed
            num_segments = math.ceil(total_height / BROWSER_HEIGHT)

            for i in range(num_segments):
                tmp = tempfile.NamedTemporaryFile(mode='w+', delete=False)

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
                
                screenshot_files.append(tmp.name)
            
            html = page.content()
            browser.close()
    except Exception as e:
        for ss in screenshot_files:
            os.remove(ss)
        raise e

    return html, screenshot_files