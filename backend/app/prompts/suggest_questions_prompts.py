
# We don't do anything with context yet...
def get_suggest_questions_system_prompt(nquestions, chunks, question, context):
    start = f"""You are tasked with suggesting good follow-up questions related to some source material and a user's conversation with it. You must suggest exactly {nquestions} question{'s' if nquestions > 1 else ''}."""
    questions_posed_to_doc = "The questions should be asked about the source material; not directed toward the user. It should be answered somewhere in the source."
    example = """Your response should be in JSON format. Here is the correct schema given as an example when n is 3: {"questions": ["Why is the sky blue?", "What does the author mean by 'dialectic'?", "Where did this take place?"]}"""
    
    doc = "Here are samples from the document to help make your question(s) relevant:\n\n"
    for chunk in chunks:
        doc += "[...]\n\n" + chunk.txt + "\n\n[...]"
    return "\n".join([start, questions_posed_to_doc, example, doc])

def get_suggest_questions_prompt(nquestions, question):
    question = f"""Here is the user's last question to help you create the follow-up(s): "{question}". Now respond with {nquestions} question{'s' if nquestions > 1 else ''} using the correct JSON schema."""
    return question

def get_suggest_questions_system_prompt_detached(n, question):
    start = f"""You are tasked with suggesting good follow-up questions for a user's conversation. You must suggest exactly {n} question{'s' if n > 1 else ''}."""
    example = """Your response should be in JSON format. Here is the correct schema given as an example when n is 3: {"questions": ["Why is the sky blue?", "What does the author mean by 'dialectic'?", "Where did this take place?"]}"""
    return "\n".join([start, example])
