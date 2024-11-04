

def get_brainstorm_system_prompt(length, background, level):

    options_header = "Some IMPORTANT NOTES from the user:\n" if length or level or background else ""
    length_text = f"\nTarget length of the course: {length}. Please limit the content of the course to this length." if length else ""
    level_text = f"\nTarget course level: {level}." if level else ""
    background_text = f"""\nUser quote about background: "{background}\" """ if background else ""
    return f"""You are tasked with constructing a curriculum. The user has given a topic that he wishes to learn about.
Provide an outline of topics for the course. There is no need to mention any specific books or resources at this stage. YOU MUST keep the outline to {"fewer than 3 sections" if not length else length} unless otherwise instructed. Delineate the subsections as lists using '*'. Follow the user's instructions above all.
{options_header}{level_text}{background_text}{length_text}"""


def get_to_structured_system_prompt():
    return """You are tasked with converting the user's curriculum into well-formatted JSON.
The JSON string you provide should be a list under the 'content' key, with nested objects that define the title of the section (under the key "title") and any nested subsections, should there be any (under the key "subsections"). The subsections themselves are objects.
Here's an example of the schema:

{"content": [{"title": "Section 1", "subsections": [{"title": "Subsection 1"}]}, {"title": "Section 2"}]}

Be sure to include all the subsections from the text.

YOU MUST INCLUDE ONLY THE JSON TEXT IN YOUR RESPONSE; NO FORMATTING OR COMMENTARY.

"""

def get_desc_system_prompt(outline):
    return f""" Write a paragraph about the specified topic. Use a scholarly writing style, such as you might find in a textbook. Ignore the mention of any section numbers; just write about the topic.
Here is the AI response that the course is based off of, which includes an outline of the full work. It's included so you understand the context:

```
{outline}
```"""


NUM_SOURCES = 3

# Context is list of leaf titles across the whole doc
def get_link_system_prompt(user_statement, section_title, context=[]):
    
    prompt = f"A user is matching sources to his course. Here is a message from the user about something he wants to learn:\n\n{user_statement}"
    prompt += f"\nYour task is to pick at most {NUM_SOURCES} sources that would be most useful for a particular section (you may select fewer or none at all). Your current selections will go in the section titled \"{section_title}\"."
    prompt += f"You must keep your selections relevant to THIS SECTION of the course."

    if context and len(context):
        full_sections = "\n".join(f"{i+1}. {x}" for i, x in enumerate(context))
        prompt += f"Here is the full course with all its sections:\n {full_sections}\n\nYou should choose the appropriate sources **FOR THE CURRENT SUBSECTION ONLY ({section_title})**. **If a resource would be a better fit in some other section, DO NOT include it, since your current selection will be removed from the list for the other sections.**\n"

    prompt += "You must respond only with the source numbers, separated into new lines, like in this example:\n\n"
    prompt += "5\n12\n15"

    return prompt
    

# Results is expected to be a list of asset manifest rows
def get_link_prompt(results, title):

    prompt = "Here are the sources you can choose from:\n\n"
    
    for i, res in enumerate(results):
        prompt += f"Source #{i+1}: '{res['title']}' by {res['author']}. {res['preview_desc']}\n\n"
    
    prompt += f"Reminder, the section is titled '{title}'. Please choose the best {NUM_SOURCES} sources; include only the source numbers."
    return prompt



def get_fake_brainstorm_system_prompt(sources):
    intro = "You are roleplaying as a student. The user will give you a list of readings that are related to what you want to learn. You should respond with a short sentence describing your interest. For example, you might start your response, 'I want to learn about...'. What you want to learn should be related to the core ideas of the readings."
    return intro

def get_fake_brainstorm_prompt(sources):
    sources_text = "\n".join([f"{i+1}. {x['title']}" for i, x in enumerate(sources)])
    return sources_text
