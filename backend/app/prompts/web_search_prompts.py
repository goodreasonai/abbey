from datetime import datetime

def get_web_query_system_prompt(context, retrieval_response, user_time):
    prompt = []

    prelude = f"Current Date: {user_time}\nA user is asking a question for which you are tasked to write a search engine query (to be entered into Google). Don't use any advanced query features like quotes, operators, or sites."
    prompt.append(prelude)

    if len(retrieval_response):
        ret_text = "Here is related source material that user can currently see:"
        ret_text += "\n\n".join([f"*BEGIN EXCERPT*\n{x.txt}\n*END EXCERPT*" for x in retrieval_response])
        prompt.append(ret_text)

    if len(context):
        context_text = "Here is the conversational context of the question:"
        context_text += "\n".join([f"User: {x['user']}\nAI: {x['ai']}" for x in context])
        prompt.append(context_text)

    conclusion = "Transform the user's question into a search query. Include ONLY THE SEARCH QUERY in your response; no yapping."
    prompt.append(conclusion)
    return "\n".join(prompt)


# Doesn't assume user is asking question; instead, uses "text" context (i.e., video script)
def get_web_image_query_system_prompt():
    date_str = datetime.now().strftime("%Y-%m-%d")
    prelude = f"Current Date: {date_str}\nYour task is to write a brief (about 1-4 words) image search engine query based on some text that the user will provide. You are searching for a relevant image. Don't use any advanced query features like quotes, operators, or sites."
    conclusion = "Include ONLY THE SEARCH QUERY in your response; no yapping."
    return "\n".join([prelude, conclusion])

