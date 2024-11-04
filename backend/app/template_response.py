import json
import tempfile
from flask import Response, send_file

from .utils import make_json_serializable
from .storage_interface import download_file
import os
import io


class MyResponse():
    
    def __init__(self, success: bool, data: dict = {}, reason: str = None, status: int = None) -> None:
        self.success = success
        self.data = data
        self.reason = reason
        self.status = status
    
    def to_json(self):

        new_data = make_json_serializable(self.data)

        if 'response' in new_data:
            raise Warning("Found 'response' as key in data; overwriting 'response': success in json.")
        response_dict = {
            'response': 'success' if self.success else 'failed',
            **new_data
        }

        # Maybe in the future, give a code matching the reason.
        if not self.status:
            self.status = 200 if self.success else 500

        if self.reason:
            response_dict['reason'] = self.reason
        to_return = json.dumps(response_dict)
        return Response(to_return, status=self.status, mimetype='application/json')


# For the files endpoint
# res is an asset resources row (or assset group resources row)
def response_from_resource(res, mimetype, filename=None, only_headers=False):
    try:
        if only_headers:
            response = send_file(io.BytesIO(b''), mimetype=mimetype, download_name=filename)
            response.headers['Access-Control-Expose-Headers'] = 'Content-Disposition'
            return response
        
        with tempfile.NamedTemporaryFile(delete=True) as temp_file:
            download_file(temp_file.name, res)
            response = send_file(temp_file.name, mimetype=mimetype, download_name=filename)
            response.headers['Access-Control-Expose-Headers'] = 'Content-Disposition'
            return response
    
    except NotImplementedError as e:
        return MyResponse(False, reason=str(e)).to_json()
    except FileNotFoundError as e:
        return MyResponse(False, reason=str(e)).to_json()
