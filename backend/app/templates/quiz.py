from .template import Template
from flask import (
    Blueprint,
    request
)
from ..auth import token_required, User
from ..asset_actions import (
    get_asset, get_asset_metadata, upload_asset, make_retriever,
    get_sources, set_sources, delete_asset, get_asset_resources,
    get_or_create_retriever, get_assets
)
from flask_cors import cross_origin
from ..template_response import MyResponse
from ..db import get_db, needs_db
from ..batch_and_stream_lm import stream_batched_lm
from ..integrations.lm import LM, LM_PROVIDERS, LONG_CONTEXT_CHAT_MODEL, ALT_LONG_CONTEXT_MODEL, BALANCED_CHAT_MODEL, FAST_CHAT_MODEL, DEFAULT_CHAT_MODEL
from ..prompts.quiz_prompts import (
    get_question_grader_system_prompt, get_question_grader_prompt,
    get_create_question_system_prompt_mcq, get_create_question_prompt_mcq,
    get_create_question_system_prompt_sa, get_create_question_prompt_sa,
    get_bulk_create_question_system_prompt_sa, get_bulk_create_question_prompt_sa,
    get_bulk_create_question_system_prompt_mcq, get_bulk_create_question_prompt_mcq,
    get_explain_system_prompt, get_explain_prompt, get_matching_assets_user_prompt, get_matching_assets_sys_prompt
)
from ..prompts.question_theme_prompts.mcat import get_passage_sys_prompt, get_passage_prompt
import json
import sys
from ..utils import get_unique_id
import random
from ..retriever import Retriever
from concurrent.futures import ThreadPoolExecutor, as_completed
from ..configs.str_constants import RETRIEVAL_SOURCE, QUIZ_GRADE_ACTIVITY, MULTIPLE_CHOICE, SHORT_ANSWER
from ..configs.user_config import APP_NAME
from ..auth import get_permissioning_string
from ..activity import make_log
from ..auth import get_users
from ..integrations.auth import FullUser


bp = Blueprint('quiz', __name__, url_prefix="/quiz")


# Dependent on frontend
def make_question(text, type, data={}, points=2, sources=[]):
    return {
        'text': text,
        'points': points,
        'type': type,
        'data': data,
        'sources': sources,
        'id': get_unique_id()
    }


def generate_question(ret: Retriever, qtype=None, prev_q_texts=[], mcq_prob=.75):
    chunks = ret.random(5)  # we should probably dedup with previous questions
    if not qtype:
        qtype = MULTIPLE_CHOICE if random.random() < mcq_prob else SHORT_ANSWER
    if qtype == MULTIPLE_CHOICE:
        # MULTIPLE CHOICE
        sys_prompt = get_create_question_system_prompt_mcq(prev_q_texts)
        prompt = get_create_question_prompt_mcq(chunks)
        tries = 0
        while tries < 2:
            lm: LM = LM_PROVIDERS[BALANCED_CHAT_MODEL]
            resp = lm.run(prompt, system_prompt=sys_prompt, make_json=True)
            try:
                my_json = json.loads(resp)
                question = my_json['question']
                responses: list = my_json['responses']

                resp_letts = "ABCDEFGHIJKLMNOP"[:len(responses)]

                # Even though it's told not to, remove preceding "A. " stuff from the responses.
                for i, resp in enumerate(responses):
                    # Cleanse the questions of this common LLM mistake, including the letter in the answers (despite being told not to)
                    patterns = [lambda x: f"{x}. ", lambda x: f"{x}) ", lambda x: f"{x}: "]  # Where X is A, B, C, D, ...
                    if sum([sum([resp.find(p(l)) == 0 for l in resp_letts]) > 0 for p in patterns]):
                        responses[i] = responses[i][3:]

                answer = my_json['answer'].upper()
                ans_index = resp_letts.index(answer)  # raises ValueError if not found
                if ans_index >= len(responses):
                    raise ValueError()
                
                desired_correct_index = random.randrange(0, len(responses))
                true_response = responses[ans_index]
                tmp = responses[desired_correct_index]
                responses[desired_correct_index] = true_response
                responses[ans_index] = tmp
                answer = resp_letts[desired_correct_index]

                q = make_question(question, MULTIPLE_CHOICE, {'responses': [{'text': x} for x in responses]}, points=1)
                return q, answer

            except (ValueError, KeyError) as e:
                print(f"{e} Couldn't create multiple choice question: {resp}", file=sys.stderr)
                tries += 1
    elif qtype == SHORT_ANSWER:
        # SHORT ANSWER
        sys_prompt = get_create_question_system_prompt_sa(prev_q_texts)
        prompt = get_create_question_prompt_sa(chunks)
        tries = 0
        while tries < 2:
            lm: LM = LM_PROVIDERS[BALANCED_CHAT_MODEL]
            resp = lm.run(prompt, system_prompt=sys_prompt, make_json=True)
            try:
                my_json = json.loads(resp)
                question = my_json['question']
                answer = my_json['answer']
                q = make_question(question, SHORT_ANSWER, points=2)
                return q, answer
            except (ValueError, KeyError) as e:
                print(f"Couldn't create short answer question: {resp}", file=sys.stderr)
                tries += 1
    else:
        print(f'Question type "{qtype}" not recognized', file=sys.stderr)

    return False, False


# Like generate_question, except using long context model to do all batches at the same
# Can only do one type of question! For multiple, call separate types for each type.
# qtype = MULTIPLE_CHOICE | SHORT_ANSWER
# difficulty = easier | harder (only changes in response to harder)
# Returns ([...questions], {qid: answer...})
def generate_questions_lc(ret: Retriever, qtype, n, prev_q_texts=[], points=1, sources=[], difficulty='easier', theme_code='default'):
    # Bit of a weird maneuever ... designed to give some more variability in the questions.
    qtheme: QuestionTheme = get_theme_by_code(theme_code)
    chosen_model = qtheme.get_model()
    TEMPERATURE = .9  # This function has a tendency to repeat itself, so we set the temperature a bit higher.
    lm: LM = LM_PROVIDERS[chosen_model]
    chunks = ret.max_chunks(lm)
    qtheme: QuestionTheme = get_theme_by_code(theme_code)
    if qtype == MULTIPLE_CHOICE:
        # MULTIPLE CHOICE
        sys_prompt, prompt = qtheme.get_mcq_prompts(n, prev_q_texts, difficulty, chunks)
        tries = 0
        while tries < 2:
            resp = lm.run(prompt, system_prompt=sys_prompt, make_json=True, temperature=TEMPERATURE)
            try:
                my_json = json.loads(resp)
                full_questions = qtheme.process_response_mcq(my_json)
                # Split up questions and answers
                questions = []
                answers = {}
                for full_q in full_questions:
                    responses = full_q['responses']
                    answer = full_q['answer']
                    resp_letts = "ABCDEFGHIJKLMNOP"[:len(responses)]

                    # Even though it's told not to, remove preceding "A. " stuff from the responses.
                    for i, respi in enumerate(responses):
                        # Cleanse the questions of this common LLM mistake, including the letter in the answers (despite being told not to)
                        patterns = [lambda x: f"{x}. ", lambda x: f"{x}) ", lambda x: f"{x}: "]  # Where X is A, B, C, D, ...
                        if sum([sum([respi.find(p(l)) == 0 for l in resp_letts]) > 0 for p in patterns]):
                            responses[i] = responses[i][3:]

                    answer = full_q['answer'].upper()
                    ans_index = resp_letts.index(answer)  # raises ValueError if not found
                    if ans_index >= len(responses):
                        raise ValueError()
                    
                    # Randomize correct answer/responses
                    desired_correct_index = random.randrange(0, len(responses))
                    true_response = responses[ans_index]
                    tmp = responses[desired_correct_index]
                    responses[desired_correct_index] = true_response
                    responses[ans_index] = tmp
                    answer = resp_letts[desired_correct_index]
                    
                    question = make_question(full_q['text'], MULTIPLE_CHOICE, {'responses': [{'text': x} for x in responses]}, points=points, sources=sources)
                    questions.append(question)
                    answers[question['id']] = answer
                return questions, answers
                
            except (ValueError, KeyError) as e:
                print(f"{e} Couldn't create multiple choice question: {resp}", file=sys.stderr)
                tries += 1
    elif qtype == SHORT_ANSWER:
        sys_prompt, prompt = qtheme.get_sa_prompts(n, prev_q_texts, difficulty, chunks)
        # Expectation is to get: {'questions': [{'text': '', 'answer': ''}, ...]}
        tries = 0
        while tries < 2:
            resp = lm.run(prompt, system_prompt=sys_prompt, make_json=True, temperature=TEMPERATURE)
            try:
                my_json = json.loads(resp)
                full_questions = qtheme.process_response_sa(my_json)
                # Split up questions and answers
                questions = []
                answers = {}
                for full_q in full_questions:
                    question = make_question(full_q['text'], SHORT_ANSWER, points=points, sources=sources)
                    answer = full_q['answer']
                    questions.append(question)
                    answers[question['id']] = answer
                return questions, answers
            except (ValueError, KeyError) as e:
                print(f"Couldn't create short answer question: {resp}", file=sys.stderr)
                tries += 1
    else:
        print(f'Question type "{qtype}" not recognized', file=sys.stderr)
    
    return False, False

# Question themes rn is unused because it didn't quite work for MCAT 7/11/24
class QuestionTheme:
    code: str
    def __init__(self, code) -> None:
        self.code = code

    def get_mcq_prompts(self, n, prev_q_texts, difficulty, chunks):
        return (get_bulk_create_question_system_prompt_mcq(n, chunks), get_bulk_create_question_prompt_mcq(n, prev_q_texts, difficulty))

    def get_sa_prompts(self, n, prev_q_texts, difficulty, chunks):
        return (get_bulk_create_question_system_prompt_sa(n, prev_q_texts), get_bulk_create_question_prompt_sa(n, chunks, difficulty))

    def get_model(self):
        return ALT_LONG_CONTEXT_MODEL if random.random() > .5 else LONG_CONTEXT_CHAT_MODEL
    
    # Given JSON output from the model, return a list of questions with keys "question", "responses", "answer"
    def process_response_mcq(self, json_resp):
        return json_resp['questions']
    
    # Given JSON output from the model, return a list of questions with keys "question", "answer"
    def process_response_sa(self, json_resp):
        return json_resp['questions']

class DefaultTheme(QuestionTheme):
    def __init__(self) -> None:
        super().__init__('default')

class MCATTheme(QuestionTheme):
    def __init__(self) -> None:
        super().__init__('mcat')

    def get_mcq_prompts(self, n, prev_q_texts, difficulty, chunks):
        # 50% you get a regular one, 50% you get a passage version.
        if False and random.random() > .5:
            return super().get_mcq_prompts(n, prev_q_texts, difficulty, chunks)
        else:
            # TODO add difficulty
            return get_passage_sys_prompt(n), get_passage_prompt(n, chunks)
    
    def get_sa_prompts(self, n, prev_q_texts, difficulty, chunks):
        return super().get_sa_prompts(n, prev_q_texts, difficulty, chunks)

    def get_model(self):
        return ALT_LONG_CONTEXT_MODEL
    
    def process_response_mcq(self, json_resp):
        qs = json_resp['questions']
        if 'passage' in json_resp:
            passage = json_resp['passage']
            for q in qs:
                q['text'] = passage + "\n\n" + q['text']
        return qs


QUESTION_THEMES = {
    DefaultTheme(),
    MCATTheme()
}

def get_theme_by_code(code):
    for q in QUESTION_THEMES:
        q: QuestionTheme
        if q.code == code:
            return q
    return DefaultTheme()


# Used to get an existing quiz based on a document
@bp.route('/find', methods=('GET',))
@cross_origin()
@token_required
def find_(user: User):
    id = request.args.get('id')
    assert(int(id))  # so much for id = 0!

    asset_row = get_asset(user, id)
    if not asset_row:
        return MyResponse(False, reason="Couldn't get asset").to_json()

    db = get_db()

    sql = f"""
        WITH a as (
            SELECT *
            FROM assets
            JOIN (
                SELECT a.asset_id AS asset_id
                FROM asset_metadata a 
                LEFT JOIN asset_metadata b ON a.asset_id = b.asset_id 
                AND b.`key` = '{RETRIEVAL_SOURCE}' AND b.`value` != '{asset_row['id']}'
                WHERE a.`key` = '{RETRIEVAL_SOURCE}' AND a.`value` = '{asset_row['id']}' 
                AND b.asset_id IS NULL
                GROUP BY a.asset_id
            ) AS am
            ON assets.id = am.asset_id
            WHERE assets.template = 'quiz'
            GROUP BY assets.id
        )
        SELECT * FROM a
        LEFT JOIN asset_permissions ap ON a.id = ap.asset_id OR a.group_id = ap.group_id
        WHERE {get_permissioning_string(user)} 
    """
    curr = db.cursor()
    curr.execute(sql)
    res = curr.fetchone()
    if res:
        return MyResponse(True, {'result': res}).to_json()
    return MyResponse(True).to_json()


@bp.route('/create', methods=('POST',))
@cross_origin()
@token_required
def create(user: User):
    ids = request.json.get('ids')  # source document ids
    user_title = request.json.get('title')  # overrides auto title
    replace_quiz = request.json.get('replace')
    total_questions = request.json.get('n')
    if not total_questions:
        total_questions = 5

    desc_key = 'quiz_desc'
    ans_key = 'quiz_answers'

    asset_rows = []
    for id in ids:
        asset_row = get_asset(user, id)
        if asset_row:
            asset_rows.append(asset_row)

    db = get_db()

    retrievers = []
    for asset_row in asset_rows:
        ret = make_retriever(user, asset_row, db=db)
        retrievers.append(ret)

    questions = []
    answers = {}

    with ThreadPoolExecutor() as executor:
        futures = [executor.submit(generate_question, retrievers[i % len(retrievers)]) for i in range(total_questions)]
        for future in as_completed(futures):
            q, ans = future.result()
            if q:
                questions.append(q)
                answers[q['id']] = ans
    
    title = f"Quiz for {', '.join([x['title'] for x in asset_rows[:3]])}" if not user_title else user_title
    preview_desc = f"Quiz based on {', '.join([x['title'] for x in asset_rows])}" if len(asset_rows) else "Auto-created quiz"
    success, msg = upload_asset(user, None, title, "", preview_desc, 'quiz', APP_NAME, False, db=db, no_commit=True)

    if not success:
        return MyResponse(False, f"Could not upload quiz: {msg}").to_json()
    
    asset_id = msg

    # Insert a lil metadata
    sql = """
    INSERT INTO asset_metadata (`asset_id`, `key`, `value`, `user_id`) VALUES
    (%s, %s, %s, %s)
    """
    curr = db.cursor()
    curr.execute(sql, (asset_id, desc_key, json.dumps({'questions': questions, 'show_feedback': True}), user.user_id))
    curr.execute(sql, (asset_id, ans_key, json.dumps(answers), user.user_id))

    set_sources(user, asset_id, [x['id'] for x in asset_rows], db=db, no_commit=True)  # sources of quiz

    if replace_quiz:
        replace_quiz_row = get_asset(user, replace_quiz, needs_edit_permission=True)
        if replace_quiz_row:
            delete_asset(replace_quiz_row, db=db, no_commit=True)

    db.commit()

    return MyResponse(True, {'asset_id': asset_id}).to_json()


# Note that it doesn't change the database
# The user still needs to save the quiz.
@bp.route('/gen-q', methods=('POST',))
@cross_origin()
@token_required
def gen_q(user: User):
    id = request.json.get('id')
    asset_row = get_asset(user, id)  # not actually changing DB, don't need edit perms.
    if not asset_row:
        return MyResponse(False, reason="Couldn't get asset").to_json()
    
    qtype = request.json.get('type')
    theme = request.json.get('theme', 'default')
    if qtype not in [MULTIPLE_CHOICE, SHORT_ANSWER]:
        return MyResponse(False, reason=f"Question type '{qtype}' not recognized").to_json()

    db = get_db()
    sources = get_sources(user, id, db=db)
    if not sources:
        return MyResponse(False, reason="There were no sources for the quiz").to_json()
    choice = random.randrange(0, len(sources))
    ret = make_retriever(user, sources[choice], db=db)

    question_texts = []
    try:
        prev_qs, _ = get_asset_metadata(user, id, keys=['quiz_desc'], get_total=False)
        if prev_qs and len(prev_qs):
            val = json.loads(prev_qs[0]['value'])
            questions = val['questions']
            question_texts = [q['text'] for q in questions]
    except Exception as e:
        # Failed to get existing questions - bad, but not fatal
        print(f"Failed to get existing questions for quiz (asset id = {id}), {e}", file=sys.stderr)

    qs, answers = generate_questions_lc(ret, n=1, qtype=qtype, prev_q_texts=question_texts, points=(2 if qtype == SHORT_ANSWER else 1), theme_code=theme)
    q = qs[0]
    ans = answers[q['id']]
    return MyResponse(True, {'question': q, 'answer': ans}).to_json()


@bp.route('/grade', methods=('POST',))
@cross_origin()
@token_required
def grade(user: User):
    
    id = request.json.get('id')

    asset_row = get_asset(user, id)
    if not asset_row:
        return MyResponse(False, reason="Couldn't locate asset").to_json()
    
    user_answers = request.json.get('answers')
    
    # Would use get_asset_metadata except it has built-in safeguards against retrieving retrieving the answers
    # Might be best in the future to control that behavior with an argument
    sql = """
    SELECT * FROM `asset_metadata`
    WHERE `asset_id`=%s AND `key`=%s
    """

    db = get_db()
    curr = db.cursor()
    curr.execute(sql, (id, 'quiz_answers'))
    answers = curr.fetchone()
    if answers:
        answers = json.loads(answers['value'])
    else:
        return MyResponse(False, reason="Couldn't find answer key").to_json()

    db = get_db()
    curr = db.cursor()
    sql = """
    SELECT * FROM `asset_metadata`
    WHERE `asset_id`=%s AND `key`=%s
    """
    curr.execute(sql, (id, 'quiz_desc'))
    desc = curr.fetchone()
    if not desc:
        return MyResponse(False, reason="Can't find quiz on the server").to_json()
    desc = json.loads(desc['value'])

    q_by_q = {}
    for i, question in enumerate(desc['questions']):
        try:
            user_answer = user_answers[question['id']]
        except KeyError:  # user didn't answer
            q_by_q[question['id']] = {
                'points': 0,
                'total': question['points'],
                'index': i
            }
            continue
        
        try:
            answer_key = answers[question['id']]
        except KeyError:  # there is no answer for this question
            q_by_q[question['id']] = {
                'points': question['points'],
                'total': question['points'],
                'index': i
            }
            continue
        
        if question['type'] == 'Multiple Choice':  # yuck
            grade = 0
            if user_answer.lower() == answer_key.lower():
                grade = question['points']
            q_by_q[question['id']] = {
                'points': grade,
                'total': question['points'],
                'index': i
            }
        elif int(question['points']) > 0:
            q_by_q[question['id']] = {
                'total': question['points'],
                'index': i
            }

    to_grade = [x for x in q_by_q if 'points' not in q_by_q[x]]  # No "points" key in q_by_q entry means it needs to be graded by GPT
    data_list = [get_question_grader_prompt(answers[x], user_answers[x], q_by_q[x]['total']) for x in to_grade]

    results = [0 for _ in range(len(to_grade))]

    def gen():

        db = get_db()
        curr = db.cursor()

        for val in q_by_q.values():
            if 'points' in val:
                yield "1,"

        for result, index in stream_batched_lm(data_list, lm=LM_PROVIDERS[BALANCED_CHAT_MODEL], system_prompt=get_question_grader_system_prompt(), make_json=True):
            results[index] = json.loads(result)['points']
            yield "1,"

        for i, res in enumerate(results):
            q_by_q[to_grade[i]]['points'] = res

        total_points = sum([int(x['points']) for x in q_by_q.values()])
        available_points = sum([int(x['total']) for x in q_by_q.values()])

        quiz_grade = {'total_points': total_points, 'available_points': available_points, 'q_by_q': q_by_q, 'user_answers': user_answers}

        if 'show_feedback' in desc and desc['show_feedback']:
            quiz_grade['correct_answers'] = answers

        sql = """
        INSERT INTO `asset_metadata` (`asset_id`, `key`, `value`, `user_id`)
        VALUES (%s, %s, %s, %s)
        """
        curr.execute(sql, (id, 'quiz_grade', json.dumps(quiz_grade), user.user_id))

        make_log(user, id, None, QUIZ_GRADE_ACTIVITY, json.dumps(quiz_grade), db=db)

        # Technically unnecessary due to the make_log and shared db
        db.commit()

        yield "<START>" + json.dumps(quiz_grade)

    return gen()


# Get all grades associated with a quiz, aggregated by user, including user info (like name)
@bp.route('/grades', methods=('GET',))
@cross_origin()
@token_required
def grades(user: User):
    asset_id = request.args.get('id')
    asset_row = get_asset(user, asset_id, needs_edit_permission=True)
    if not asset_row:
        return MyResponse(False, reason="Quiz not found", status=404).to_json()
    
    # Get quiz grades
    quiz_grades, _ = get_asset_metadata(user, asset_id, keys=['quiz_grade'], for_all_users=True, get_total=False)

    user_ids = [x['user_id'] for x in quiz_grades]
    users = get_users(user_ids=user_ids)

    results = []
    for auth_user in users:
        auth_user: FullUser
        user_id = auth_user.user_id

        first_name = auth_user.first_name
        last_name = auth_user.last_name
        primary_email = auth_user.email_address
        
        relevant_grades = []
        for grade in quiz_grades:
            if grade['user_id'] == user_id:
                relevant_grades.append(grade)

        res = {
            'first_name': first_name,
            'last_name': last_name,
            'email': primary_email,
            'grades': relevant_grades
        }
        results.append(res)
    
    return MyResponse(True, {'results': results}).to_json()


@bp.route('/explain', methods=('POST',))
@cross_origin()
@token_required
def explain(user: User):
    asset_id = request.json.get('id')
    asset_row = get_asset(user, asset_id)
    if not asset_row:
        return MyResponse(False, reason=f"Couldn't find asset with id {asset_id}", status=404).to_json()

    sources = request.json.get('sources')
    question = request.json.get('question')
    user_answer = request.json.get('user_answer')
    correct_answer = request.json.get('correct_answer')

    ret = get_or_create_retriever(user, asset_row, sources, "retriever")

    lm: LM = LM_PROVIDERS[LONG_CONTEXT_CHAT_MODEL]
    chunks = ret.max_chunks(lm, context=question['text'])

    system_prompt = get_explain_system_prompt(chunks)

    # For multiple choice, we need to append the responses next to the letters
    if question['type'] == MULTIPLE_CHOICE:
        extra = {}
        alpha = 'ABCDEFGHIJKLMNOP'
        for i, resp in enumerate(question['data']['responses']):
            extra[alpha[i]] = resp['text']
        user_answer = f"{user_answer.upper()}. {extra[user_answer.upper()]}" if user_answer else "(pass)"
        correct_answer = f"{correct_answer.upper()}. {extra[correct_answer.upper()]}"

    prompt = get_explain_prompt(question['text'], user_answer, correct_answer)

    return lm.stream(prompt, system_prompt=system_prompt)


@bp.route('/matching-assets', methods=('POST',))
@cross_origin()
@token_required
def get_matching_assets(user: User):
    sources = request.json.get('sources')  # asset resources
    answer = request.json.get('answer')  # explanation answer
    sourced_assets_ids = [x['asset_id'] for x in sources]
    asset_rows = get_assets(user, sourced_assets_ids)
    if not asset_rows:
        return MyResponse(True, {'results': []}).to_json()
    if len(asset_rows) <= 2:
        return MyResponse(True, {'results': asset_rows}).to_json()
    
    asset_rows = asset_rows[:26]  # arbitrary max
    sys_prompt = get_matching_assets_sys_prompt()
    user_prompt = get_matching_assets_user_prompt(asset_rows, answer)

    lm: LM = LM_PROVIDERS[FAST_CHAT_MODEL]
    raw_out = lm.run(user_prompt, system_prompt=sys_prompt, make_json=True)
    letter_choices = json.loads(raw_out)['choices']
    index_choices = ["ABCDEFGHIJKLMNOPQRSTUVWXYZ".find(l.upper()) for l in letter_choices]
    chosen_assets = [asset_rows[x] for x in index_choices]
    return MyResponse(True, {'results': chosen_assets}).to_json()
    


class Quiz(Template):
    def __init__(self) -> None:
        super().__init__()
        self.code = "quiz"
        self.chattable = False
        self.summarizable = False
        self.metadata_modify_with_edit_perm = ['quiz_desc', 'quiz_answers', 'quiz_grade']
        self.metadata_hidden_wo_edit_perm = ['quiz_answers']
        self.metadata_user_specific = ['quiz_response', 'quiz_grade']

    @needs_db
    def upload(self, user: User, asset_id, is_editing, asset_title="", using_auto_title=False, using_auto_desc=False, db=None):
        
        selections = request.form.get('selections')
        if selections:
            selections = json.loads(selections)
            set_sources(user, asset_id, selections, db=db, no_commit=True)

        return True, asset_id


