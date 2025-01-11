from flask import Flask, request, jsonify
import sys
import os
from dotenv import load_dotenv
import ipaddress
import socket
from urllib.parse import urlparse
import os
from worker import scrape_task
import json


app = Flask(__name__)

"""

Flask server runs and gets requests to scrape.

The server worker process spawned by gunicorn itself maintains a separate pool of scraping workers (there should be just one server worker - see Dockerfile).

Upon a request to /scrape, the gunicorn worker asks the pool for a process to run a scrape, which spawns an isolated browser context.

The scrape workers are limited in their memory usage to 3 GB, of which there may be 4.

"""

# For optional API key
load_dotenv()  # Load in API keys
SCRAPER_API_KEYS = [value for key, value in os.environ.items() if key.startswith('SCRAPER_API_KEY')]

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
    if len(SCRAPER_API_KEYS):
        auth_header = request.headers.get('Authorization')
        if auth_header is None:
            return jsonify({"error": "Authorization header is missing"}), 401

        if not auth_header.startswith('Bearer '):
            return jsonify({"error": "Invalid authorization header format"}), 401

        user_key = auth_header.split(' ')[1]
        if user_key not in SCRAPER_API_KEYS:
            return jsonify({'error': 'Invalid API key'}), 301

    url = request.json.get('url')

    if not url:
        return jsonify({'error': 'No URL provided'}), 400
    if not url_is_safe(url):
        return jsonify({'error': 'URL was judged to be unsafe'}), 400

    wait = max(min(int(request.json.get('wait', 1000)), 5000), 0)  # Clamp between 0-5000ms

    content_file = None
    try:
        status, headers, content_file, screenshot_files, metadata = scrape_task.apply_async(args=[url, wait], kwargs={}).get(timeout=60)  # 60 seconds
        headers = {str(k).lower(): v for k, v in headers.items()}  # make headers all lowercase (they're case insensitive)
    except Exception as e:
        # If scrape_in_child uses too much memory, it seems to end up here.
        # however, if exit(0) is called, I find it doesn't.
        print(f"Exception raised from scraping process: {e}", file=sys.stderr, flush=True)

    successful = True if content_file else False

    if successful:
        boundary = 'Boundary712sAM12MVaJff23NXJ'  # typed out some random digits
        # Generate a mixed multipart response
        # See details on the standard here: https://www.w3.org/Protocols/rfc1341/7_2_Multipart.html
        def stream():
            # Start with headers and status as json
            yield f"--{boundary}\r\nContent-Type: application/json\r\n\r\n".encode()  # beginning of content
            yield json.dumps({
                'status': status,
                'headers': headers,
                'metadata': metadata
            })
            yield "\r\n".encode()  # end of content

            # Give content as it was received
            yield f"--{boundary}\r\nContent-Type: {headers['content-type']}\r\n\r\n".encode()  # beginning of content
            with open(content_file, 'rb') as content:
                for line in content:
                    yield line
            yield "\r\n".encode()  # end of content

            # Give screenshot images
            for ss in screenshot_files:
                yield f"--{boundary}\r\nContent-Type: image/jpeg\r\n\r\n".encode()  # beginning of content
                with open(ss, 'rb') as content:
                    for line in content:
                        yield line
                yield "\r\n".encode()  # end of content
            
            # End boundary
            yield f"--{boundary}--\r\n".encode()

        return stream(), 200, {'Content-Type': f'multipart/mixed; boundary="{boundary}"'}

    else:
        return jsonify({
            'error': "This is a generic error message; sorry about that."
        }), 500
