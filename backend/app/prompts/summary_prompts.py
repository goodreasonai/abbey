
def get_summary_apply_instructions():
    return "Take detailed summary notes on this section of the document."

def get_summary_reduce_instructions():
    return "Combine the above summary notes, which are taken from different parts of the same document. Keep the most important information. Your resulting summary should be 2-4 paragraphs. Eliminate redundancy."

def get_quick_summary_prompt():
    return "Now, please summarize the content. Be concise. Use citations where appropriate, in the specified \cit{}{} schema starting 1, 2, 3..."
    
def get_key_points_user_prompt(max_n=5):
    return f"Please give less than {max_n} bullet points based on the notes, written in a concise note-taking style."

