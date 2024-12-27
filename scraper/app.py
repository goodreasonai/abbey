from flask import Flask, request, jsonify
import tempfile
import sys
import os
from dotenv import load_dotenv
import ipaddress
import socket
from urllib.parse import urlparse
import os
from worker import scrape_task 
from PIL import Image
import io


app = Flask(__name__)

"""

Flask server runs and gets requests to scrape.

The server worker process spawned by gunicorn itself maintains a separate pool of scraping workers (there should be just one server worker - see Dockerfile).

Upon a request to /scrape, the gunicorn worker asks the pool for a process to run a scrape, which spawns an isolated browser context.

The scrape workers are limited in their memory usage to 3 GB, of which there may be 4.

"""

# For optional API key
DOTENV_PATH = '/etc/abbey/.env'
load_dotenv(DOTENV_PATH)  # Load in environment variables
SCRAPER_API_KEY = os.environ.get("SCRAPER_API_KEY")  # For requests to the scraper

MAX_SCREENSHOT_SIZE_MB = 500


@app.route('/')
def home():
    return "A rollicking band of pirates we, who tired of tossing on the sea, are trying our hands at burglary, with weapons grim and gory."


def is_private_ip(ip_str: str) -> bool:
    """
    Checks if the given IP address string (e.g., '10.0.0.1', '127.0.0.1')
    is private, loopback, or link-local.
    """
    try:
        ip_obj = ipaddress.ip_address(ip_str)
        return (
            ip_obj.is_loopback or
            ip_obj.is_private or
            ip_obj.is_reserved or
            ip_obj.is_link_local or
            ip_obj.is_multicast
        )
    except ValueError:
        return True  # If it can't parse, treat as "potentially unsafe"


def url_is_safe(url: str, allowed_schemes=None) -> bool:
    if allowed_schemes is None:
        # By default, let's only allow http(s)
        allowed_schemes = {"http", "https"}

    # Parse the URL
    parsed = urlparse(url.strip())
    scheme = parsed.scheme.lower()
    netloc = parsed.netloc.split(':')[0]  # extract host portion w/o port
    if scheme not in allowed_schemes:
        print(f"URL blocked: scheme '{scheme}' is not allowed.", file=sys.stderr)
        return False

    try:
        # Resolve the domain name to IP addresses
        # This can raise socket.gaierror if domain does not exist
        addrs = socket.getaddrinfo(netloc, None)
    except socket.gaierror:
        print(f"URL blocked: cannot resolve domain {netloc}", file=sys.stderr)
        return False

    # Check each resolved address
    for addrinfo in addrs:
        ip_str = addrinfo[4][0]
        if is_private_ip(ip_str):
            print(f"URL blocked: IP {ip_str} for domain {netloc} is private/loopback/link-local.", file=sys.stderr)
            return False

    # If all resolved IPs appear safe, pass it
    return True


@app.route('/scrape', methods=('POST',))
def scrape():
    if SCRAPER_API_KEY:
        user_key = request.headers.get('x-access-token')
        if user_key != SCRAPER_API_KEY:
            return jsonify({'success': False, 'error': 'Invalid API key'}), 301

    url = request.json.get('url')

    if not url:
        return jsonify({'success': False, 'error': 'No URL provided'}), 400
    if not url_is_safe(url):
        return jsonify({'success': False, 'error': 'URL was judged to be unsafe'}), 400

    wait = max(min(int(request.json.get('wait', 1000)), 5000), 0)  # Clamp between 0-5000ms
    tmp = tempfile.NamedTemporaryFile(mode='w+', delete=False)

    html = None
    try:
        result = scrape_task.apply_async(args=[url, tmp.name, wait], kwargs={}).get(timeout=60)  # 60 seconds
        html = result
    except Exception as e:
        # If scrape_in_child uses too much memory, it seems to end up here.
        # however, if exit(0) is called, I find it doesn't.
        print(f"Exception raised from scraping process: {e}", file=sys.stderr, flush=True)

    successful = True if html else False
    screenshot = None

    if successful:
        # Read the screenshot file
        size = os.path.getsize(tmp.name)        
        with Image.open(tmp.name) as img:
            if size >= MAX_SCREENSHOT_SIZE_MB * 1024:
                # Calculate new dimensions while maintaining aspect ratio
                ratio = min(MAX_SCREENSHOT_SIZE_MB * 1024 / size, 1.0)
                new_width = int(img.width * ratio ** 0.5)
                new_height = int(img.height * ratio ** 0.5)
                
                # Resize the image
                img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
                
                # Save to bytes
                buffer = io.BytesIO()
                img.save(buffer, format='PNG', optimize=True)
                screenshot_bytes = buffer.getvalue()
            else:
                # If size is okay, just read the original
                with open(tmp.name, 'rb') as f:
                    screenshot_bytes = f.read()
            
            screenshot = screenshot_bytes.hex()

    tmp.close()
    
    if successful:
        return jsonify({
            'success': True,
            'data': {
                'html': html,
                'screenshot': screenshot
            }
        }), 200

    else:
        return jsonify({
            'success': False,
            'error': "This is a generic error message; sorry about that."
        }), 500
