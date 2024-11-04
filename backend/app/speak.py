import json
from flask_cors import cross_origin
from flask import (
    Blueprint,
    request
)
from .auth import token_optional, User

from .configs.user_config import DEFAULT_TTS_MODEL
from .template_response import MyResponse, response_from_resource
import sys
import gevent
from flask_socketio import Namespace, emit
from .activity import make_log
from .db import get_db, needs_db
from .configs.str_constants import SPEAK_ACTIVITY
import tempfile
from .storage_interface import upload_media, download_file
from .asset_actions import get_asset
import hashlib
import json
from .configs.str_constants import MEDIA_USER_INFO
from mutagen.mp3 import MP3
import io
from .utils import mimetype_from_ext
from .integrations.tts import TTS, TTS_PROVIDERS


# NOTE: only works for MP3 atm
def get_audio_duration(filename):
    audio = MP3(filename)
    duration = audio.info.length
    return duration


# Filename is for a temp audio file. Text is for hash.
@needs_db
def save_audio_media(fname, asset_id, name, text="", ext="mp3", model_code=DEFAULT_TTS_MODEL, db=None):
    path, from_ = upload_media(fname, ext)
    text_hash = hashlib.sha256(text.encode('utf-8')).hexdigest()  # gets checked in on_start_stream
    metadata = {
        'text_hash': text_hash,
        'model_code': model_code
    }
    sql = """
        INSERT INTO media_data (`asset_id`, `name`, `media_type`, `extension`, `from`, `path`, `metadata`)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
    """
    curr = db.cursor()
    curr.execute(sql, (asset_id, name, 'audio', ext, from_, path, json.dumps(metadata)))
    db.commit()


# Gets entry from media_media table
# Use txt if you want to compare to a hash
# Not permissioned
@needs_db
def get_media(asset_id, name, txt=None, db=None):
    curr = db.cursor()
    if txt is not None:
        text_hash = hashlib.sha256(txt.encode('utf-8')).hexdigest()
        sql = """
        SELECT * FROM media_data
        WHERE `asset_id`=%s AND `name`=%s AND JSON_EXTRACT(`metadata`, '$.text_hash')=%s
        ORDER BY `time_uploaded` DESC
        """
        curr.execute(sql, (asset_id, name, text_hash))
        res = curr.fetchone()
        return res
    else:
        sql = """
        SELECT * FROM media_data
        WHERE `asset_id`=%s AND `name`=%s
        ORDER BY `time_uploaded` DESC
        """
        curr.execute(sql, (asset_id, name))
        res = curr.fetchone()
        return res


class SpeakNamespace(Namespace):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.clients = {}  # ugh I think this is thread safe enough?

    def on_connect(self):
        self.clients[request.sid] = True

    def on_disconnect(self):
        self.clients[request.sid] = False

    def on_time_update(self, data):
        asset_id = data['id']
        name = data['name']
        time = data['time']  # in seconds
        token = data['x-access-token']

        try:
            user = User(token)
        except:
            return
                
        meta_key = MEDIA_USER_INFO.format(name=name)
        
        # Other code depends on this schema
        data = {
            'time': time
        }

        db = get_db()
        curr = db.cursor()
        
        # Some fun new SQL technique.
        # Try to update the row
        sql = """
            UPDATE asset_metadata
            SET `value` = %s
            WHERE `asset_id` = %s AND `key` = %s AND `user_id` = %s
        """
        curr.execute(sql, (json.dumps(data), asset_id, meta_key, user.user_id))

        # Check if the update affected any rows
        # Note that it's possible to get a duplicate here ... unfortunately
        if curr.rowcount == 0:
            # If not, insert a new row
            sql = """
                INSERT INTO asset_metadata (`asset_id`, `key`, `value`, `user_id`)
                VALUES (%s, %s, %s, %s)
            """
            curr.execute(sql, (asset_id, meta_key, json.dumps(data), user.user_id))
        
        db.commit()

    # Checks for text consistency but not model code consistency
    def stream_audio_from_existing(self, media_row, speed=1.0):
        tmp = tempfile.NamedTemporaryFile(delete=False)
        try:
            download_file(tmp.name, media_row)
            try:
                duration = get_audio_duration(tmp.name)
                emit('total_time', {'data': duration, 'estimate': False})
            except:
                print("Failed to calculate exact time for audio; perhaps file is not MP3?", file=sys.stderr)

            with open(tmp.name, 'rb') as fhand:
                while True:
                    chunk = fhand.read(4096)
                    if len(chunk) == 0:
                        break
                    emit('audio_chunk', {'data': chunk})
                    gevent.sleep(0)  # Yield to other clients/sessions ... necessary?

                    abandoned = request.sid not in self.clients or not self.clients[request.sid]
                    if abandoned:
                        break
        finally:
            tmp.close()
                

    def stream_audio_via_websocket(self, model_code, txt: str, asset_id, name, speed=1.0):
        model: TTS = TTS_PROVIDERS[model_code]
        stream_tts_fn = model.stream
        audio_file = tempfile.NamedTemporaryFile()
        time_estimate = model.estimate(txt)
        emit('total_time', {'data': time_estimate, 'estimate': True})

        try:
            abandoned = False
            ext, gen = stream_tts_fn(txt, speed=speed)
            for chunk in gen:
                emit('audio_chunk', {'data': chunk})
                gevent.sleep(0)  # Yield to other clients/sessions ... necessary?
                abandoned = request.sid not in self.clients or not self.clients[request.sid]
                if abandoned:
                    break
                else:
                    audio_file.write(chunk)  # Save the chunk to the file

            # save on complete
            if not abandoned:
                try:
                    duration = get_audio_duration(audio_file.name)
                    emit('total_time', {'data': duration, 'estimate': False})
                except:
                    print("Failed to calculate exact time for audio; perhaps file is not MP3?", file=sys.stderr)

                save_audio_media(audio_file.name, asset_id, name, txt, ext=ext, model_code=model_code, new_conn=True)

        except Exception as e:
            print(f"Error streaming audio: {e}", file=sys.stderr)
            emit('error', {'message': str(e)})
        
        audio_file.close()
        

    def on_start_stream(self, data):
        txt: str = data.get('txt')
        speed = data.get('speed', 1.0)
        asset_id = data.get('id')
        name = data.get('name')
        token = data.get('x-access-token')
        user = None
        try:
            user = User(token)
        except:
            emit('error', {'message': 'user authentication failed'})
            return
        
        asset_row = get_asset(user, asset_id)
        if not asset_row:
            emit('error', {'message': "couldn't find asset"})
            return

        db = get_db(new_connection=True)

        # Find existing (note that if txt is undefined, no hash will be used)
        res = get_media(asset_id, name, txt=txt, db=db)

        from .user import get_user_tts_model_code
        model_code = get_user_tts_model_code(user, db=db)
            
        make_log(user, None, None, SPEAK_ACTIVITY, metadata=json.dumps({'txt': txt}), db=db)

        if not res and txt:
            self.stream_audio_via_websocket(model_code, txt, asset_id, name, speed)
        elif res:
            # Find existing time
            meta_key = MEDIA_USER_INFO.format(name=name)
            sql = """
                SELECT * FROM asset_metadata
                WHERE `asset_id`=%s AND `key`=%s AND `user_id`=%s
                ORDER BY `time_uploaded` DESC
            """
            curr = db.cursor()
            curr.execute(sql, (asset_id, meta_key, user.user_id))
            media_info = curr.fetchone()
            curr.close()
            if media_info:
                seconds = json.loads(media_info['value'])['time']
                emit('set_audio_time', {'seconds': seconds})
            else:
                emit('set_audio_time', {'seconds': 0})
            self.stream_audio_from_existing(res, speed=speed)
        else:
            emit('error', {'message': 'No existing audio found, and no text supplied.'})
            return

def register_sockets(socketio):
    socketio.on_namespace(SpeakNamespace('/speak'))


bp = Blueprint('audio', __name__, url_prefix="/audio")

# Rather than getting a stream like through a web socket (which will also keep track of time, etc.),
# simply gives the whole file. Suitable for use with audio tag.
@bp.route('/get', methods=('GET',))
@token_optional
@cross_origin()
def get_audio_file_(user: User):
    asset_id = request.args.get('id')
    asset = get_asset(user, asset_id)
    if not asset:
        return MyResponse(False, reason=f"Asset with id {asset_id} not found", status=404).to_json()
    
    name = request.args.get('name', None)
    if not name:
        return MyResponse(False, reason="Need a name to process the request").to_json()
    
    media = get_media(asset_id, name)
    if not media:
        return MyResponse(False, reason=f"Media with name {name} and asset id {asset_id} not found", status=404).to_json()
    
    tmp = tempfile.NamedTemporaryFile(delete=False)
    try:
        download_file(tmp.name, media)
        return response_from_resource(media, mimetype_from_ext(media['extension']))
    finally:
        tmp.close()
    
