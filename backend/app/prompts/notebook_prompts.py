from ..utils import get_token_estimate

def get_key_points_system_prompt(block_texts):
    preface = """Your task is to turn a bunch of notes into a few key takeaways. Your bullet points should be concise and in a short-hand, just as student's notes in a class may be similarly brief. Your response should be in a JSON format, conforming to the following schema:"""
    schema = """
    {
        "bullets": [
            {"text": "Your bullet point", "citations": ["noteId1", "noteId2"]},
            ...
        ]
    }"""
    end_beginning = "Here are the notes, which are separated into blocks each with their own ID:"
    block_text = "\n\n".join(block_texts)

    return "\n".join([preface, schema, end_beginning, block_text])
    
def get_key_points_user_prompt(max_n=5):
    return f"Please give less than {max_n} bullet points based on the notes, written in a concise note-taking style."

def get_outline_system_prompt(block_texts):
    preface = """Your task is to write a brief outline of a notebook. Your goal is to provide headers suitable for a table of contents; each header around 3 words, and certainly to more than 5. Your response should be in a JSON format, conforming to the following schema:"""
    schema = """
    {
        "outline": [
            {"heading": "Your First Heading", "top": "noteId1"},
            ...
        ]
    }"""
    end_beginning = "Note that the \"top\" key denotes the ID of the note which appears first in the section you recognized. Here are the notes, which are separated into blocks each with their own ID:"
    block_text = "\n\n".join(block_texts)
    return "\n".join([preface, schema, end_beginning, block_text])

def get_outline_user_prompt(max_n=5):
    return f"Please give an outline containing less than {max_n} headers based on the notes, which together make a brief table of contents."

def make_title_system_prompt():
    return ("""You are an AI assistant tasked with coming up with titles for a notebook. You respond with JSON, formatted like {"title": "New Title"}. This title is just a few words (never more than 8, ideally only 3 or 4). It is meant to be related to the user's notes.""")
