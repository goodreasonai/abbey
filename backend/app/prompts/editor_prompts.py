from ..retriever import Chunk

def get_editor_continue_chunks_preamble():
    return "The user's document is based on source material. Below you can find parts of the sources; they may or may not be helpful."

def get_editor_continue_chunks_text(chunks):
    prompt = ""
    for source in chunks:
        source: Chunk
        prompt += f"*EXCERPT from {source.source_name}*\n"
        prompt += source.txt
        prompt += "\n*END of EXCERPT*\n\n"
    return prompt

def get_editor_continue_conclusion():
    return "The user will now provide the context into which your text will be directly pasted."

def get_editor_continue_preamble():
    prompt = "A user is writing a text document. Your task is to pick up where the user left off and continue the text for about a paragraph in length."
    prompt += "\nThe user's message will contain the most recent context. Your text will be directly appended to it. Do not include anything in your response besides the text to be appended. You are picking up exactly where the user left off: maybe in the middle of a word, sentence, or paragraph."
    prompt += "\nYou may (but are NOT REQUIRED to) use certain HTML tags for styling purposes, provided you don't use any attributes or CSS: <table> (and associated elements), <b>, <i>, <h1>, <h2>, <h3>, <ol>, <ul>, and <li>. Do not use CSS, Markdown, or Javascript for styling; just HTML tags. Do not use any HTML tags besides these ones mentioned - all others are forbidden."
    prompt += " You may also use latex, provided it is delimited using brackets, like \\( \\) or \\[ \\]."
    return prompt

def get_editor_continue_system_prompt(chunks=[], preamble=None, conclusion=None):
    preamble = preamble if preamble else get_editor_continue_preamble()
    chunks_preamble = get_editor_continue_chunks_preamble()
    chunks_text = get_editor_continue_chunks_text(chunks)
    conclusion = conclusion if conclusion else get_editor_continue_conclusion()
    return "\n".join([preamble, chunks_preamble, chunks_text, conclusion])



def get_editor_outline_preamble():
    prompt = """A user is writing a text document. Your task is to write an outline based on the source material.
The user's message will contain the most recent context, if there is any. Your text will be directly appended to it.
You may stylize your text only using HTML header tags: NO CSS, NO JAVASCRIPT, and NO MARKDOWN. Use <h2> tags for headers; all else is forbidden.
Your outline should be no more than 5 headers. Do not include any text besides the <=5 headers.
"""
    return prompt

def get_editor_outline_conclusion():
    prompt = """The user will now provide the context into which your text will be directly pasted (it may be empty). Remember the above rules: use <h2> and <h3> tags for headings and subheadings; do not use any Markdown. Do not include any subheadings or bullets; only give less than or equal to 5 headers (for example, use just 2-3 when appropriate)."""
    return prompt