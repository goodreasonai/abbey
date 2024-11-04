

def get_autofill_prompt():
    return """The following is a portion of a document which contains questions for a responder.
Your task is to output JSON containing just those questions, exactly as they appear in the document.
The JSON data should be a list containing one or more objects. Each object should have as key 'question', whose value is the question string.
You must include only the JSON data, correctly formatted with appropriate escape characters."""


def get_chat_system_prompt(extra_instructions, sources):
    prompt = f"A business or individual is responding to a questionnaire."
    prompt += f" You are tasked with writing a draft response to one of the questions using information from the following excerpts."
    prompt += f" Be as specific as possible, but keep the details relevant to the question. \n"
    prompt += f" You should be dispassionate and truthful. Do not editorialize about the company's benefits: there is no need to exaggerate or use excessive sales language."
    prompt += f" Stick to the facts. Do not use adjectives or adverbs that do not have substance."

    if extra_instructions:
        prompt += f" Important extra instructions from the user: {extra_instructions}\n"
    
    prompt += f"<BEGIN EXCERPTS>\n\n"
    for i, source in enumerate(sources):
        prompt += f"EXCERPT {i+1}\n"
        prompt += source
        prompt += "\n\n"
    prompt += f"<END EXCERPTS>"
    return prompt


def get_chat_prompt(extra_instructions, question):
    prompt = ""
    if extra_instructions:
        prompt += f"To repeat, here are very important extra instructions given by the user: "
        prompt += f"{extra_instructions}\n"
    prompt += f"Here is the new question: {question}"
    return prompt
