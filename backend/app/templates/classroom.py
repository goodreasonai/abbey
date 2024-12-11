from ..auth import User, get_users, token_required

from flask import (
    request,
)
from ..db import get_db, needs_db
from ..configs.str_constants import *
from .template import Template, EmailRules
import json
import sys
from flask import (
    Blueprint
)
from ..auth import token_optional
from flask_cors import cross_origin
from ..asset_actions import get_asset, get_asset_metadata, get_assets, set_sources
from ..template_response import MyResponse
from ..activity import get_aggregated_activity
from ..asset_actions import propagate_joint_permissions
from ..configs.user_config import FRONTEND_URL
from ..email import send_email
from datetime import datetime
from ..integrations.auth import FullUser
import pytz


bp = Blueprint('classroom', __name__, url_prefix="/classroom")

@bp.route('/get', methods=('GET',))
@cross_origin()
@token_optional
def get_classroom(user: User):
    id = request.args.get('id')
    db = get_db()
    
    can_edit = True
    asset_row = get_asset(user, id, append_can_edit=True, db=db)
    if not asset_row:
        return MyResponse(False, "Couldn't get asset").to_json()
    
    can_edit = asset_row['can_edit']

    response_dict = {}

    metadata, _ = get_asset_metadata(user, id, ['classroom_value', 'classroom_privileged', PERMISSIONS_REQUEST], get_total=False, reverse=True, db=db)
    student_user_ids = []
    pending_student_ids = []
    if metadata and len(metadata) > 0:
        for meta in metadata:
            if meta['key'] == 'classroom_privileged':
                response_dict['privileged'] = json.loads(meta['value'])
            elif meta['key'] == 'classroom_value':
                response_dict['value'] = json.loads(meta['value'])
            elif meta['key'] == PERMISSIONS_REQUEST:
                status = int(meta['value'])
                if status == 1:
                    student_user_ids.append(meta['user_id'])
                elif status == 0:
                    pending_student_ids.append(meta['user_id'])
                    # Is the user viewing this page right now a pending student?
                    if user.user_id == meta['user_id']:
                        response_dict['needs_attention'] = meta

    students = []   
    if len(student_user_ids):
        user_info = get_users(user_ids=student_user_ids)
        students = user_info

    pending_students = []
    if len(pending_student_ids):
        pending_user_info = get_users(user_ids=pending_student_ids)
        pending_students = [x.email_address for x in pending_user_info]
        
    response_dict['students'] = [s.to_json() for s in students]
    response_dict['pending_students'] = pending_students

    # We also want to give the latest info on all the assignments
    if 'value' in response_dict and 'assignments' in response_dict['value'] and response_dict['value']['assignments'] and len(response_dict['value']['assignments']):
        assignments = get_assets(user, response_dict['value']['assignments'])
        assignments_info = {x['id']: x for x in assignments}
        response_dict['assignment_info'] = assignments_info  # the discrepancy in spelling is unfortunate

        # If the user can edit, we want student activity
        if can_edit and 'students' in response_dict and len(response_dict['students']):
            response_dict['aggregated_activity'] = get_aggregated_activity(user, id, student_user_ids, response_dict['value']['assignments'])
            
    return MyResponse(True, response_dict).to_json()


@bp.route('/save', methods=('POST',))
@cross_origin()
@token_optional
def save_classroom_value(user: User):
    id = request.json.get('id')
    asset_row = get_asset(user, id, needs_edit_permission=True)
    if not asset_row:
        return MyResponse(False, reason="Can't find asset to save to", status=404).to_json()
    
    classroom_value = request.json.get('value')

    sources = []
    # Make assignments sources
    if 'assignments' in classroom_value and classroom_value['assignments'] and len(classroom_value['assignments']):
        sources = classroom_value['assignments']

    db = get_db()

    # Set sources will only do the necessary adds / permissioning stuff
    set_sources(user, id, sources, db=db, no_commit=True)
    curr = db.cursor()

    # Now actually update / insert the asset metadata
    sql = """
    DELETE FROM asset_metadata WHERE `asset_id`=%s AND `key`=%s
    """
    curr.execute(sql, (id, 'classroom_value'))
    sql = """
    INSERT INTO asset_metadata (`asset_id`, `key`, `value`, `user_id`)
    VALUES (%s, %s, %s, %s)
    """
    curr.execute(sql, (id, 'classroom_value', json.dumps(classroom_value), user.user_id))

    db.commit()

    return MyResponse(True, {'result': classroom_value}).to_json()


@bp.route('/save-students', methods=('POST',))
@cross_origin()
@token_optional
def save_students(user: User):
    id = request.json.get('id')
    asset = get_asset(user, id, needs_edit_permission=True)
    if not asset:
        return MyResponse(False, reason="Could not find asset with edit permission").to_json()
    
    students_json = request.json.get('students')
    set_students(user, id, students_json, title=asset['title'])
    return MyResponse(True, {'result': students_json}).to_json()

# This mimics behavior in set_students and other functions, like /get;
#    changing this function alone will not change the students in all cases.
@needs_db
def get_students(user, asset_id, db=None):
    metadata, _ = get_asset_metadata(user, asset_id, [PERMISSIONS_REQUEST], get_total=False, reverse=True, db=db)
    student_user_ids = []
    for meta in metadata:
        status = int(meta['value'])
        if status == 1:
            student_user_ids.append(meta['user_id'])

    if not len(student_user_ids):
        return []

    user_info = get_users(user_ids=student_user_ids)
    return user_info


# Returns (assignments, due dates)
@needs_db
def get_assignments(user, asset_id, db=None):
    metadata, _ = get_asset_metadata(user, asset_id, ['classroom_value'], get_total=False, db=db)
    if len(metadata) == 0:
        return []
    
    val = json.loads(metadata[0]['value'])
    if 'assignments' not in val:
        return []
    
    assignments = get_assets(user, val['assignments'])

    due_dates = val['dueDates']

    return assignments, due_dates


"""
Students json is of the form [{'email': ''}, ...]

NOT PERMISSIONED
"""
@needs_db
def set_students(user, asset_id, students_json, title="", db=None, no_commit=False):

    curr = db.cursor()

    student_emails = [x['email'] for x in students_json]
    student_users = get_users(emails=student_emails)
    student_ids = [x.user_id for x in student_users]
    ids_to_emails = {u.user_id: u.email_address for u in student_users}

    if len(student_ids) < len(student_emails):
        # This is from debugging a weird blank save bug.
        print(f"Strange: found fewer student ids ({len(student_ids)}) than emails ({len(student_emails)})", file=sys.stderr)

    # Go through all of the current users and remove those students who are not in the current edit
    
    sql = f"""
        SELECT * FROM asset_metadata
        WHERE `asset_id`=%s
        AND `key`='{PERMISSIONS_REQUEST}'
    """
    curr.execute(sql, (asset_id,))
    
    # This can and should probably be put into a single sql query.
    results = curr.fetchall()
    for res in results:
        if res['user_id'] not in student_ids:
            sql = """
                DELETE FROM asset_metadata
                WHERE `id`=%s
            """
            curr.execute(sql, (res['id'],))

    # Go through the current uploaded users
    # For those who have rejected, resend a request
    # If they don't even exist in the system yet, add them
    changed_permissions = False
    need_emails = []  # students which should receive email notification
    for i, student in enumerate(student_users):
        sql = f"""
            SELECT * FROM asset_metadata
            WHERE `asset_id` = %s
            AND `key` = '{PERMISSIONS_REQUEST}' AND `user_id`=%s
        """
        curr.execute(sql, (asset_id, student.user_id))
        res = curr.fetchone()
        if res:
            if int(res['value']) == 0:
                # User hasn't responded yet
                pass
            elif int(res['value']) == 1:
                # User already accepted
                pass
            elif int(res['value']) == 2:
                # User rejected, resend
                sql = """
                    UPDATE asset_metadata
                    SET `value`=0, `needs_attention`=1
                    WHERE `id`=%s
                """
                curr.execute(sql, (res['id'],))
        else:
            sql = """
                INSERT INTO asset_metadata (`asset_id`, `key`, `value`, `user_id`, `needs_attention`)
                VALUES (%s, %s, %s, %s, %s)
            """
            curr.execute(sql, (asset_id, PERMISSIONS_REQUEST, 0, student.user_id, 1))
            
            # Add a view permission for the accepting user.
            # Note that we're not going through set_asset_permissions in this case, but you should probably use it!
            sql = """
                INSERT INTO asset_permissions (`asset_id`, `email_domain`)
                VALUES (%s, %s)
            """
            email = ids_to_emails[student.user_id]
            curr.execute(sql, (asset_id, email))
            need_emails.append(email)
            changed_permissions = True

    if changed_permissions:
        propagate_joint_permissions(user, asset_id, db=db, no_commit=no_commit)

    if len(need_emails):
        if not title:
            title = "Classroom"
        classroom_link = f"{FRONTEND_URL}/assets/{asset_id}"
        subject = f"Invitation to Join {title}"
        email_body = f'Hello,<br><br>You have been invited to join {title} on Abbey. Join here: <a href="{classroom_link}">{classroom_link}</a>.'
        send_email(need_emails, subject, email_body, user=user)



class ClassroomEmailRules(EmailRules):
    def __init__(self) -> None:
        super().__init__()
        self.allowed_endpoints = ['reminder']
        self.needs_edit_permission_endpoints = ['reminder']
    def get_email(self, user, asset_row, endpoint, data):
        studs = get_students(user, asset_row['id'])  # this needs db fyi .. for all those celery folx
        recipients = [x.email_address for x in studs]
        if endpoint == 'reminder':
            assignments, due_dates = get_assignments(user, asset_row['id'])
            pst = pytz.timezone('America/Los_Angeles')  # Pacific time supremacy (it's western, so we don't miss anything)
            date_objs = [(key, pst.localize(datetime.strptime(due_dates[key], "%Y-%m-%d %H:%M"))) for key in due_dates]
            now = datetime.now(pst)
            future_dates = [(key, date) for key, date in date_objs if date > now]
            future_dates.sort(key=lambda x: abs(x[1] - now))
            closest_dates = future_dates[:2]
            
            latest_assignments = []
            for key, _ in closest_dates:
                for assignment in assignments:
                    if int(key) == assignment['id']:
                        latest_assignments.append(assignment)
            latest_assignment_1 = ""
            latest_assignment_2 = ""
            classroom_link = FRONTEND_URL + f"/assets/{asset_row['id']}"
            classroom_name = asset_row['title']
            
            subject = f"{classroom_name} - Assignments Due"
            email_body = f'Hello,<br><br>Please be aware that there are assignments coming due in {classroom_name}. Check out your classroom here: <a href="{classroom_link}">{classroom_link}</a>.'
            
            if len(latest_assignments):
                latest_assignment_1 = f"{latest_assignments[0]['title']} due {datetime.strftime(closest_dates[0][1], '%Y-%m-%d %H:%M')}"
                if len(latest_assignments) == 2:
                    latest_assignment_2 = f"{latest_assignments[1]['title']} due {datetime.strftime(closest_dates[1][1], '%Y-%m-%d %H:%M')}"
                email_body = f'Hello,<br><br>Please be aware that there are assignments coming due in {classroom_name}. Check out your classroom here: <a href="{classroom_link}">{classroom_link}</a>.<br><h3>Assignments Due Soon</h3>{latest_assignment_1}' + (f"<br><br>{latest_assignment_2}" if latest_assignment_2 else "")

            return {
                'subject': subject,
                'recipients': recipients,
                'email_body': email_body
            }

        raise Exception("Endpoint unrecognized in get email")


class Classroom(Template):
    def __init__(self) -> None:
        super().__init__()
        self.chattable = False
        self.summarizable = False
        self.code = "classroom"
        self.metadata_modify_with_edit_perm: list = ['classroom_value']  # which metadata keys can be modified in assets/save-metadata when the user has edit permissions
        self.metadata_hidden_wo_edit_perm: list = ['classroom_privileged']  # which metadata keys cannot be viewed without edit permission
        self.email_rules = ClassroomEmailRules()

    @token_required
    def process_needs_attention_response(user: User, self, asset_metadata_row, data):
        
        kind = asset_metadata_row['key']

        db = get_db()
        curr = db.cursor()
        
        if kind == PERMISSIONS_REQUEST:
            
            new_value = 1 if data['response'] == 'accept' else 2
            sql = """
                UPDATE asset_metadata
                SET `value`=%s, `needs_attention`=0
                WHERE `user_id`=%s
                AND `id`=%s
            """
            curr.execute(sql, (new_value, user.user_id, asset_metadata_row['id']))

        else:
            raise NotImplementedError(f"Needs attention response for template '{self.code}' can't understand kind '{kind}'")

        db.commit()

    @needs_db
    def upload(self, user: User, asset_id, is_editing, asset_title="", using_auto_title=False, using_auto_desc=False, db=None):
        
        student_objects_string = request.form.get('students')

        students_json = []

        if student_objects_string:
            try:
                students_json = json.loads(student_objects_string)
            except ValueError as e:
                print(f"Student json was malformed: '{student_objects_string}'", file=sys.stderr)
                raise e

        set_students(user, asset_id, students_json, title=asset_title, db=db, no_commit=True)

        return True, asset_id
