from flask_socketio import Namespace, emit, join_room, leave_room
from flask import request
from .asset_actions import get_asset
from .auth import User, get_users
from .templates.templates import get_template_by_code
from .templates.template import Template
from .integrations.auth import FullUser


class CollabNamespace(Namespace):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.clients = {}  # Session id -> (user info, list of asset ids)
        self.rooms = {}  # asset id -> list of (session id, user info)

    def on_connect(self):
        # Nothing happens on connect - only join room.
        pass

    def on_disconnect(self):
        session_id = request.sid
        if session_id in self.clients:
            _, rooms = self.clients[session_id]
            for room in rooms:
                if room in self.rooms:
                    room_info = self.rooms[room]
                    filtered_room_info = [x for x in room_info if x[0] != session_id]
                    self.rooms[room] = filtered_room_info
                    updated_user_info = [{**(x[1].to_json()), 'sid': x[0]} for x in filtered_room_info]
                    leave_room(room)
                    emit('user_update', {'users': updated_user_info}, room=room)


    def on_join(self, data):
        asset_id = data['asset_id']
        user_token = data['token']
        user = None
        try:
            user = User(user_token)
        except:
            # Invalid token
            pass

        asset = get_asset(user, asset_id)

        if not asset:
            return
        
        session_id = request.sid
        
        # Does session ID exist in clients?
        user_info = None
        room_to_join = None

        sid = request.sid
        if sid in self.clients:
            client = self.clients[sid]
            user_info, rooms = client
            if asset_id not in rooms:
                room_to_join = asset_id
        else:
            auth_user_infos = []
            if user:
                auth_user_infos = get_users(user_ids=[user.user_id])
            user_info = user  # a User object as a fallback
            if len(auth_user_infos):
                user_info = auth_user_infos[0]  # a FullUser object
            self.clients[session_id] = (user_info, [asset_id])
            room_to_join = asset_id

        if room_to_join:
            if room_to_join in self.rooms:
                existing_sids = [x[0] for x in self.rooms[room_to_join]]
                if session_id not in existing_sids:
                    self.rooms[room_to_join].append((session_id, user_info))
                    join_room(room_to_join)
            else:
                self.rooms[room_to_join] = [(session_id, user_info)]
                join_room(room_to_join)
        
        all_current_user_infos = [{**(x[1].to_json()), 'sid': x[0]} for x in self.rooms[room_to_join]]  # the to_json only works because both User and FullUser have to_json functions.
        emit('user_update', {'users': all_current_user_infos}, room=asset_id)


    # action related to an asset gets routed to the template
    def on_action(self, data):
        asset_id = data['id']
        token = data['token']

        try:
            user = User(token)
        except:
            # Invalid token
            user = None

        asset = get_asset(user, asset_id)

        if not asset:
            return
        
        action_type = data['type']
        action_data = data['data']
        
        tmp: Template = get_template_by_code(asset['template'])
        tmp.process_collab_action(user, asset, action_type, action_data)



def register_sockets(socketio):
    socketio.on_namespace(CollabNamespace('/collab'))



