import random
import sys
from flask_cors import cross_origin

from ..template_response import MyResponse
from .template import Template
from ..db import get_db, needs_db
from ..auth import User, token_required
from flask import (
    Blueprint,
    request
)
import json
import random
from ..asset_actions import get_asset, get_asset_metadata, get_asset_resources, get_sources, get_or_create_retriever, set_sources, has_asset_title_been_updated, mark_asset_title_as_updated
from .quiz import generate_question, generate_questions_lc
from ..integrations.lm import LM, LM_PROVIDERS, FAST_CHAT_MODEL, BALANCED_CHAT_MODEL
from ..prompts.quiz_prompts import get_question_grader_system_prompt, get_question_grader_prompt, make_title_user_prompt, make_title_system_prompt
from ..utils import deduplicate
from ..configs.str_constants import MULTIPLE_CHOICE, SHORT_ANSWER, ASSET_STATE


bp = Blueprint('inf-quiz', __name__, url_prefix="/inf-quiz")


@bp.route('/make-title', methods=('POST',))
@cross_origin()
@token_required
def make_title(user: User):

    asset_id = request.json.get('id')
    sources = request.json.get('sources')

    asset_row = get_asset(user, asset_id, needs_edit_permission=True)
    if not asset_row:
        return MyResponse(False, reason="Asset not found").to_json()

    # Will abort if asset's already been edited
    has_been_edited = has_asset_title_been_updated(asset_id)
    if has_been_edited:
        return MyResponse(True, {'title': asset_row['title']}).to_json()
    
    txt = make_title_user_prompt(sources)
    lm: LM = LM_PROVIDERS[FAST_CHAT_MODEL]
    new_title = lm.run(txt, system_prompt=make_title_system_prompt()).replace("\"", "")

    sql = """
        UPDATE assets SET `title`=%s WHERE `id`=%s
    """
    db = get_db()
    curr = db.cursor()
    curr.execute(sql, (new_title, asset_id))

    mark_asset_title_as_updated(user, asset_row['id'], db=db)
    db.commit()  # should already be done by the mark_asset_title_as_updated call

    return MyResponse(True, {'title': new_title}).to_json()



@bp.route('/gen-q', methods=('POST',))
@cross_origin()
@token_required
def gen_q(user: User):
    id = request.json.get('id')
    asset_row = get_asset(user, id)
    if not asset_row:
        return MyResponse(False, reason="Couldn't get asset").to_json()

    rand_num = request.json.get('random', 25)
    batch_size = request.json.get('batch_size', 1)
    prev_qs = request.json.get('prev', [])
    difficulty = request.json.get('difficulty', 'easier')  # "easier" or "harder" atm
    focus_source_id = request.json.get('focus_source_id')

    question_texts = [q['text'] for q in prev_qs]

    db = get_db()
    sources = get_sources(user, id, db=db)
    if not sources:
        return MyResponse(False, reason="There were no sources for the quiz").to_json()

    # Include only focus sources
    if focus_source_id:
        sources = [x for x in sources if str(x['id']) == str(focus_source_id)]

    # take a random subset of sources if sources >= 3
    ret_sources = []
    for src in sources:
        ret_sources.extend(get_asset_resources(user, src, db=db))
    ret_sources = deduplicate(ret_sources, key=lambda x: x['id'])

    MAX_SOURCES = 3
    if len(sources) > MAX_SOURCES:
        ret_sources = random.sample(ret_sources, MAX_SOURCES)
        
    ret = get_or_create_retriever(user, asset_row, ret_sources, "retriever")

    # Bit silly but ok
    n_mcq = 0
    n_sa = 0
    for _ in range(batch_size):
        ismcq = random.random() * 100 > int(rand_num)
        if ismcq:
            n_mcq += 1
        else:
            n_sa += 1

    questions = []
    answers = {}
    for n, qtype, pts in [(n_mcq, MULTIPLE_CHOICE, 1), (n_sa, SHORT_ANSWER, 2)]:
        if n <= 0:
            continue
        qs, ans = generate_questions_lc(ret, qtype, n, prev_q_texts=question_texts, points=pts, difficulty=difficulty, sources=ret_sources)
        if not qs:
            return MyResponse(False, reason="Could not generate questions").to_json()
        question_texts.extend([q['text'] for q in qs])
        questions.extend(qs)
        answers = {**answers, **ans}

    random.shuffle(questions)
    return MyResponse(True, {'questions': questions, 'answers': answers}).to_json()


@bp.route('/grade', methods=('POST',))
@cross_origin()
@token_required
def grade(user: User):
    id = request.json.get('id')
    asset_row = get_asset(user, id)
    if not asset_row:
        return MyResponse(False, reason="Couldn't locate asset").to_json()
    
    answer = request.json.get('answer')
    response = request.json.get('response')
    max_points = request.json.get('max_points')

    if not answer or not response:
        return MyResponse(False, reason="Undefined answer or response").to_json()

    lm: LM = LM_PROVIDERS[BALANCED_CHAT_MODEL]
    resp = lm.run(get_question_grader_prompt(answer, response, max_points), system_prompt=get_question_grader_system_prompt(),make_json=True)

    return MyResponse(True, json.loads(resp)).to_json()


class InfiniteQuiz(Template):
    def __init__(self) -> None:
        super().__init__()
        self.chattable = False
        self.summarizable = False
        self.code = 'inf_quiz'
        self.make_retriever_on_upload = True
        self.metadata_user_specific = [ASSET_STATE]

    @needs_db
    def upload(self, user: User, asset_id, asset_title="", using_auto_title=False, using_auto_desc=False, no_commit=True, db=None):
        selections = request.form.get('selections')
        if selections:
            selections = json.loads(selections)
            set_sources(user, asset_id, selections, db=db, no_commit=True)
        return True, asset_id