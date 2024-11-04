

def get_question_grader_system_prompt():
    return """You are tasked with grading a response according to an answer key. You must respond in JSON with one key called points. Here's an example: {"points": 3}.
The score you give must be between 0 and the question's point value, inclusive. The user may use shortened language in his response and receive full points; sentence fragments or bullets are allowed."""


def get_question_grader_prompt(answer, user_answer, points):
    return f"""Available points: {points}\n\nUser's answer: {user_answer}\n\nAnswer Key: {answer}"""


def _existing_qs(prev_q_texts, trim=True):
    res = ""
    if prev_q_texts and len(prev_q_texts):
        res += "\nIt is very important that you do not repeat questions. Instead, **make them as varied as possible.** The test already has some content; please AVOID repeating these existing questions and cover new ground if possible: "
        for i, q in enumerate(prev_q_texts):
            if i < 3 or not trim:
                res += f"\n{i+1}. {q}"
            elif i == len(prev_q_texts) - 1:
                res += f"\n...\n{i+1}. {q}"
    return res


def get_create_question_system_prompt_mcq(prev_q_texts=[]):
    res = """You are tasked with writing a multiple choice question to test a reader's knowledge about a document. Try to make the question relate to the important themes of the document. You should respond with JSON that has three keys: question, responses, and answer, giving the question, the possible answer choices, and the letter of the correct answer, respectively. Here is an example:
{"question": "Should I include letters with my answers?", "responses": ["Yes", "No", "Maybe", "Yes again"], "answer": "B"}"""
    res += _existing_qs(prev_q_texts)
    return res


def get_create_question_prompt_mcq(chunks):
    pre = f"""Write a single multiple choice question based on one of the following excerpts from the document.
The user does not have access to the excerpts, so you should not expect the user to refer back to the document.\n"""
    excerpts = "\n\n".join([f"*HIDDEN EXCERPT {i+1} from {x.source_name}*\n{x.txt}\n*END OF EXCERPT*" for i, x in enumerate(chunks)])
    post = f"""\n\nNow write one multiple choice question in the correct JSON format, with answers, to test a user's knowledge about the document. Remember to not say "according to the excerpt" or reference the excerpts in any way."""
    return pre + excerpts + post


def get_create_question_system_prompt_sa(prev_q_texts):
    res = """You are tasked with writing a short answer question to test a reader's knowledge about a document. Try to make the question relate to the important themes of the document. You should respond with JSON that has two keys: question and key, which give the text of the question and a brief answer key that quickly notes how to achieve full points on the question. Here is an example:
{"question": "What kinds of themes should I touch on in my question?", "answer": "Full credit for saying the themes should be 'important' or 'major' themes."}"""
    res += _existing_qs(prev_q_texts)
    return res
    

def get_create_question_prompt_sa(chunks):
    pre = f"""Write a single short answer question based on one of the following excerpts from the document.
The user does not have access to the excerpts, so you should not expect the user to refer back to the document.\n"""
    excerpts = "\n\n".join([f"*HIDDEN EXCERPT {i+1} from {x.source_name}*\n{x.txt}\n*END OF EXCERPT*" for i, x in enumerate(chunks)])
    post = f"""\n\nNow write one short answer question in the correct JSON format to test a user's knowledge about the document. Remember to not say "according to the excerpt" or reference the excerpts in any way."""
    return pre + excerpts + post


def get_bulk_create_question_system_prompt_sa(n, prev_q_texts):
    preface = f"""You are tasked with writing {n} short answer questions to test a reader's knowledge about a document. Your questions should focus on the content rather than structure or minutiae."""
    qformat = """You should respond with JSON with one root key, "questions", which is a list of objects of the form {"text": "Question text...", "answer": "Answer text..."}. Here is an example for n=1:"""
    example = "{\"questions\": [{\"text\": \"How many questions and answers should I write?\", \"answer\": \"" + str(n) + "\"}"
    dont_repeat = _existing_qs(prev_q_texts, trim=False)
    conclusion = "Now examine the user's content and write high quality questions and answers based on it. You may use shortened language in the suggested answer; be concise."
    return "\n".join([preface, qformat, example, dont_repeat, conclusion])


def get_bulk_create_question_prompt_sa(n, chunks, difficulty='easier'):
    excerpts = "\n\n".join([f"*HIDDEN EXCERPT {i+1} from {x.source_name}*\n{x.txt}\n*END OF EXCERPT*" for i, x in enumerate(chunks)])
    dont_say_excerpt = f"""The test taker does not have access to the excerpts, so you should not expect the user to refer back to the document."""
    post = f"""Now write {n} short answer questions in the correct JSON format to test someone's knowledge about the document. Remember never to say "according to the excerpt" or reference the excerpts in any way."""
    if difficulty == 'harder':
        post += "\nNote: Please make the question(s) more difficult! They should be tricky and really test my knowledge; it's OK if the answer isn't found exactly in the content. Feel free to design your own question."
    return "\n\n".join([excerpts, dont_say_excerpt, post])


def get_bulk_create_question_system_prompt_mcq(n, chunks):
    preface = f"""You are tasked with writing {n} multiple choice questions to test a reader's knowledge about a document. Your questions should focus on the content rather than structure or minutiae."""
    qformat = """You should respond with JSON with one root key, "questions", which is a list of objects of the form {"text": "Question text...", "responses": ["First option", "Second second", "Third option", "Fourth option"], "answer": "Letter"}. Here is an example for n=1:"""
    example = "{\"questions\": [{\"text\": \"How many questions, responses, and answers should I write?\", \"responses\": [\"" + str(n - 1) + "\", \"" + str(n + 1) + "\", \"" + str(n) + "\", \"" + str(n + 2) + "\"] \"answer\": \"C\"}"
    
    excerpts_preface = "Here is the content your questions should be based on:"
    excerpts = "\n\n".join([f"*HIDDEN EXCERPT {i+1} from {x.source_name}*\n{x.txt}\n*END OF EXCERPT*" for i, x in enumerate(chunks)])
    
    dont_say_excerpt = f"""That is all the content. The test taker does not have access to the excerpts, so you should not expect the user to refer back to the document."""

    conclusion = "Now the user will provide the existing questions in the quiz, should there be any, which you should not repeat."
    return "\n".join([preface, qformat, example, excerpts_preface, excerpts, dont_say_excerpt, conclusion])


def get_bulk_create_question_prompt_mcq(n, prev_q_texts, difficulty='easier'):
    dont_repeat = _existing_qs(prev_q_texts, trim=False)
    post = f"""Now write {n} varied, new, and high quality multiple choice questions in the correct JSON format to test someone's knowledge about the document. Remember never to say "according to the excerpt" or reference the excerpts in any way."""
    if difficulty == 'harder':
        post += "\nNote: Please make the question(s) more difficult! They should be tricky and really test my knowledge; it's OK if the answer isn't found exactly in the content. Feel free to design your own question."
    return "\n\n".join([dont_repeat, post])


def get_explain_system_prompt(chunks):
    pre = f"""A user is taking a quiz. You are tasked with explaining, with reference to the source material, the correct answer for a given question. Be concise; your response should be 1-2 sentences. Note that the user already has the answer; he wants to figure out *why*."""
    sources_pre = ""
    source_text = ""
    if len(chunks):
        sources_pre = """You should make reference to the source material, including page numbers if they are provided."""
        source_text = "\n\n".join([f"*From {x.source_name}*\n{x.txt}\n*END*" for x in chunks])
    return "\n".join([pre, sources_pre, source_text])


def get_explain_prompt(question, user_response, correct_response):
    q_text = f"Question: {question}"
    user_text = f"User Response: {user_response}"
    correct_text = f"Correct Response: {correct_response}"
    return "\n".join([q_text, user_text, correct_text])


# Sources is a list of asset rows
def make_title_user_prompt(sources):
    preamble = "Sources:"
    texts = "\n".join([f"{i+1}. {x['title']} ({x['preview_desc']})" for i, x in enumerate(sources)])
    return "\n".join([preamble, texts])
    

def make_title_system_prompt():
    pre = "You are an AI assistant tasked with coming up with a title for a set of flashcards. You respond with only the text of the desired title. The title you are writing is a name for organizational purposes in a notebook."
    details = "This title is just a few words (never more than 8, ideally only 3 or 4). It is meant to be related to the user's sources, which the flashcards are based on. Your title should be of the form, '[X] Questions', where [X] is replaced with a word or phrase that captures the idea of the sources."
    example = "For example, your title might be 'Edmund Fitzgerald Questions' if the soure(s) were about the Edmund Fitzgerald."
    conclusion = "Do not say anything besides your new title (no punctuation, no quotes, no header, nothing but the text of the title itself)."
    return " ".join([pre, details, example, conclusion])


def get_matching_assets_sys_prompt():
    return 'You are tasked with choosing the best two resources that match a given sample of text. You must respond in JSON. Here is an example response, if the best matching resources corresponded to letters Y and Z: {"choices": ["Y", "Z"]}'

def get_matching_assets_user_prompt(asset_rows, answer):
    txt_sample = f"Text sample:\n\n{answer}"
    choice_text = "Resource options:\n" + "\n".join([f'{"ABCDEFGHIJKLMNOPQRSTUVWXYZ"[i]}. {x["title"]}: {x["preview_desc"]}' for i, x in enumerate(asset_rows)])

    return "\n".join([txt_sample, choice_text])
