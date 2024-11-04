

def get_chosen_group_system_prompt(groups):
    assert(len(groups))

    preface = "You are tasked with selecting the most relevant group from the following list. The items below are titles of collections of content that may be relevant to the user's text. The numbers beside the titles represent the ids of the collections. You must respond with JSON specifying one ID."
    body = "\n".join([f"{x['id']}: {x['title']}" for x in groups])
    
    first = groups[0]
    conclusion = """Respond with JSON that describes which group is most relevant. Your response must be in this schema: {"group_id": ID_OF_GROUP}.
For example, a valid response might be: {"group_id": """ + str(first['id']) + "}, which would represent the group '" + first['title'] + "'."
    return "\n\n".join([preface, body, conclusion])


def get_chosen_group_prompt(text):
    preface = "Here is the text to which you are matching a group id:"
    body = f"<START OF TEXT>\n{text}\n<END OF TEXT>"
    conclusion = "Now respond with the most relevant group, in the appropriate JSON format."
    return "\n\n".join([preface, body, conclusion])
