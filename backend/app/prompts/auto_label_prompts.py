
def get_auto_desc_system_prompt(chunks):
    preface = "A user has a document that needs a description. Your task is to write a brief, 1 sentence description of it. Below are the first few sections of the document as it has been scanned."
    body = "\n".join([x.txt for x in chunks])
    conclusion = "You should write only your description in your response. The description should not be more than 10 or so words. Be ECONOMICAL in your writing; condense your description so that only the essential, meaningful words are being used. You may start your sentence with a verb such that it's just a sentence fragment, for example."
    return "\n".join([preface, body, conclusion])
