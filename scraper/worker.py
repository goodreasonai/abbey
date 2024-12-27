from celery import Celery
from playwright.sync_api import sync_playwright
import resource

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
def scrape_task(url, screenshot_file, wait):

    soft, hard = (MEM_LIMIT_MB * 1024 * 1024, MEM_LIMIT_MB * 1024 * 1024)
    resource.setrlimit(resource.RLIMIT_AS, (soft, hard))  # Browser should inherit this limit

    html = None
    with sync_playwright() as p:
        # Should be resilient to untrusted websites
        browser = p.firefox.launch(headless=True, timeout=10_000)  # 10s startup timeout
        context = browser.new_context(viewport={"width": 1280, "height": 2000})
        
        page = context.new_page()

        # Set various security headers and limits
        page.set_default_timeout(30000)  # 30 second timeout
        page.set_default_navigation_timeout(30000)

        # Navigate to the page
        response = page.goto(url)
                
        if not response or response.status >= 400:
            raise Exception(f"Failed to load page: Status {response.status if response else 'unknown'}")
        
        # Scroll down so that the any scroll effects come into view
        page.evaluate("""
            () => {
                const scroll = () => {
                    window.scrollBy(0, window.innerHeight);
                    return window.scrollY + window.innerHeight >= document.documentElement.scrollHeight;
                };
                
                return new Promise((resolve) => {
                    const timer = setInterval(() => {
                        if (scroll()) {
                            clearInterval(timer);
                            resolve();
                        }
                    }, 100);
                });
            }
        """)

        page.wait_for_timeout(wait)
        
        page.screenshot(path=screenshot_file, full_page=True)
        html = page.content()
        browser.close()

    return html