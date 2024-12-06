from .template import Template
from ..db import needs_db, ProxyDB
from ..auth import User
from flask import (
    Blueprint,
    request,
)
import requests
from bs4 import BeautifulSoup
from youtube_transcript_api import YouTubeTranscriptApi, NoTranscriptFound
from ..asset_actions import has_asset_title_been_updated, replace_asset_resource
import re
from ..storage_interface import upload_asset_file
import re
from pytube import YouTube
import sys
from ..prompts.prompt_fragments import get_basic_ai_identity, get_video_citation_prompt
from ..configs.str_constants import MAIN_FILE
from ..configs.secrets import PROXY_URL_HTTP, PROXY_URL_HTTPS
from ..utils import format_seconds


def get_proxies():
    if PROXY_URL_HTTP and PROXY_URL_HTTPS:
        return {'http': PROXY_URL_HTTP, 'https': PROXY_URL_HTTPS}
    else:
        return None


def get_youtube_video_id(url):
    # Regular expression pattern to match YouTube video URLs
    pattern = r'^(https?://)?(www\.)?youtube\.com/watch\?v=([a-zA-Z0-9_-]{11}).*$'
    
    # Match the pattern against the input URL
    match = re.match(pattern, url)
    
    if match:
        # If a match is found, return the video ID (group 3)
        return match.group(3)
    else:
        # If no match is found, raise a ValueError
        raise ValueError("Invalid YouTube video URL")


def get_youtube_video_title_and_author(url):
    request_url = f"https://youtube.com/oembed?url={url}&format=json"
    result = requests.get(request_url, proxies=get_proxies())
    my_json = result.json()
    return my_json['title'], my_json['author_name']

    # The following used to work except pytube is having issues... literally a million issues filed in their repo about this not working. (11/30/24)
    """
    yt = YouTube(url, proxies=get_proxies())
    return yt.title, yt.author
    """


# Returns string of video transcription
# Only does Youtube right now
def get_transcription(url):
    video_id = get_youtube_video_id(url)  # if not a youtube url, will throw an error
    transcript_list = YouTubeTranscriptApi.list_transcripts(video_id, proxies=get_proxies())
    transcript_data = None
    try: 
        # First try and find a manually created transcript
        # It does this by default with get_transcript, but it doesn't include en-US for some reason (only en) which can be annoying.
        transcript = transcript_list.find_manually_created_transcript(['en', 'en-US', 'en-UK', 'en-GB'])
        transcript_data = transcript.fetch()
    except NoTranscriptFound:
        pass

    if not transcript_data:  # if no manual found, just get whatever
        try:
            transcript_data = YouTubeTranscriptApi.get_transcript(video_id, proxies=get_proxies())  # tries to get generated english
        except:
            pass

    # Coudln't get manual or generated english
    if not transcript_data:
        for t in transcript_list:  # goes through what's available
            if t.is_translatable:
                transcript_data = t.translate('en').fetch()  # try to translate to english

    if not transcript_data:
        raise Exception(f"Could not get transcription for video with id {video_id}")

    # This rigamorol puts the timestamp every few lines for citation purposes
    portions = []
    for i, x in enumerate(transcript_data):
        to_append = x['text']
        if i % 3 == 0 and 'start' in x:
            time = format_seconds(x['start'])
            to_append = f"({time}) " + to_append
        portions.append(to_append)
    transcript_text = " ".join(portions)
    return transcript_text


# Only does YouTube right now
@needs_db
def transcribe_and_upload(asset_id, url, asset_title, no_commit=False, db: ProxyDB=None):
    transcription = get_transcription(url)
    video_title = None
    video_author = None
    try:
        video_title, video_author = get_youtube_video_title_and_author(url)
    except:
        print(f"Failed to get video title for url {url}", file=sys.stderr)
        pass

    path, from_key = upload_asset_file(asset_id, None, 'txt', use_data=transcription)

    replace_asset_resource(asset_id, MAIN_FILE, from_key, path, asset_title, no_commit=False, db=db)

    curr = db.cursor()
    def insert_meta(key, val):
        sql = """
        DELETE FROM asset_metadata
        WHERE `asset_id` = %s AND `key` = %s
        """
        curr.execute(sql, (asset_id, key))
        sql = """
        INSERT INTO asset_metadata (`asset_id`, `key`, `value`)
        VALUES (%s, %s, %s)
        """
        curr.execute(sql, (asset_id, key, val))
    
    insert_meta('video_url', url)

    # Change asset title to title of video
    if video_title and not has_asset_title_been_updated(asset_id, db=db, no_commit=True):
        sql = """
        UPDATE assets SET title = %s WHERE id = %s
        """
        curr.execute(sql, (video_title, asset_id))
    
    if video_author:
        sql = """
        UPDATE assets SET author = %s WHERE id = %s
        """
        curr.execute(sql, (video_author, asset_id))


class Video(Template):
    def __init__(self) -> None:
        super().__init__()
        self.chattable = True
        self.summarizable = True
        self.code = "video"
        self.make_retriever_on_upload = True

    def build_chat_system_prompt(self, question, sources, extra_instructions="", src_title="", source_names=None):
        if source_names:
            assert(len(source_names) == len(sources))

        prompt = f"{get_basic_ai_identity()} A user is asking questions related to a video. Below are parts of the transcription."
        
        for i, source in enumerate(sources):
            source_name = ""
            if source_names:
                source_name = " " + source_names[i]

            prompt += f"*EXCERPT from {source_name}*\n"
            prompt += source
            prompt += f"\n*END of{' FINAL' if i == len(sources) - 1 else ''} EXCERPT*\n\n"

        prompt += "These excerpts may help you answer the user's question. Remember to BE CONCISE in your response.\n"

        prompt += get_video_citation_prompt()

        return prompt
    
    def build_quick_summary_system_prompt(self, chunks):
        preface = "Your task is to summarize concisely the user's transcribed video. The user knows where it comes from; do not speculate on its source. Keep the most important information. Your resulting summary should be at most 2-3 paragraphs."
        chunk_text = ""
        for chunk in chunks:
            chunk
            chunk_text += f"*START {chunk.source_name}*\n"
            chunk_text += chunk.txt
            chunk_text += "\n*END*\n\n"
        
        cits = get_video_citation_prompt()

        return "\n\n".join([preface, chunk_text, cits])
    
    def build_key_points_system_prompt(self, chunks):
        preface = "Your task is to summarize concisely the user's transcribed video. The user knows where it comes from; do not speculate on its source. Keep the most important information. Your resulting summary should be at most 2-3 paragraphs."
        chunk_text = ""
        for chunk in chunks:
            chunk
            chunk_text += f"*START {chunk.source_name}*\n"
            chunk_text += chunk.txt
            chunk_text += "\n*END*\n\n"
        
        cits = get_video_citation_prompt()

        return "\n\n".join([preface, chunk_text, cits])
    
    def build_key_points_system_prompt(self, chunks):
        # Should we cite page numbers or quotes
        preface = """Your task is to turn a source into a few key takeaways. Your bullet points should be concise and in a short-hand, just as student's notes in a class may be similarly brief. Your response should be in a JSON format, conforming to the following schema:"""
        schema = """
        {
            "bullets": [
                {"text": "Your bullet point", "citations": ["0:45", "1:12"]},
                {"text": "Your second bullet point", "citations": ["2:35"]},
                ...
            ]
        }"""
        end_beginning = "Here are parts of the original source:"
        chunk_text = ""
        for chunk in chunks:
            chunk
            chunk_text += f"*START {chunk.source_name}*\n"
            chunk_text += chunk.txt
            chunk_text += "\n*END*\n\n"

        return "\n".join([preface, schema, end_beginning, chunk_text])


    @needs_db
    def upload(self, user: User, asset_id, is_editing, asset_title="", using_auto_title=False, using_auto_desc=False, no_commit=True, db=None):
        url = request.form.get('url')
        try:
            transcribe_and_upload(asset_id, url, asset_title, db=db, no_commit=True)
        except ValueError as e:
            print(f"Exception on video upload: url is not of youtube; url={url}")
            return False, "Please use the URL of a YouTube video"
        except Exception as e:
            print(f"Exception on transcribe: {e}")
            return False, "Can't get video transcript"
        
        return True, asset_id

