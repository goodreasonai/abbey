

def get_basic_ai_identity():
    return "You are a helpful and pleasant AI assistant, writing in Markdown (with a Latex extention)."

def has_page_numbers(chunks):
    first_source_name = chunks[0].source_name
    has_pns = first_source_name.lower().find("page ") != -1  # will throw an error if len(chunks) = 0 (and that's ok)
    return has_pns

# Including the warning includes a notice in the prompt to not answer the question if there's no relevant source.
def get_citation_prompt(include_warning=True, use_page_num_example=False):
    page_num_example = "To cite an excerpt, use the syntax: \cit{Page number or text}{Citation number}. Examples: \cit{Page 13}{1} for the 1st unique citation, and \cit{Page 4}{2} for the 2nd unique citation."
    non_page_num_example = 'To cite an excerpt as a footnote, use the syntax: \cit{"Brief text"}{Citation number}. Examples: \cit{"Our mission is to help everyone..."}{1} for the 1st unique citation, and \cit{About Us section}{2} for the 2nd unique citation. Note that citations in this format are shown to the user as footnotes. If you want to use a quote in your answer, or if the user asks for a direct quote, simply give the quote, citing the section header instead.'

    base = f"""VERY IMPORTANT: Always use a citation when possible. {page_num_example if use_page_num_example else non_page_num_example} By "unique" we mean unique to the same paragraph or page of the source. Use consecutive integers for every unique citation (going 1, 2, 3, ...). Use only this citation format regardless of what the source excerpts use. Remember you are citing the excerpts given to you - not THEIR citations, should they exist, which are irrelevant."""
    warning = " If the excerpts do not give the answer, say so before trying to answer."
    if include_warning:
        return base + warning
    else:
        return base
    
def get_web_citation_prompt():
    base = "VERY IMPORTANT: Always use a citation when possible. You should cite corresponding web page(s) at the same time you draw from the sources, like a footnote. This way, the user can tell which webpages correspond to which claims. Do not put all the footnotes together at the end; splatter them around your answer."
    web_example = "To cite an excerpt, use the syntax: \cit{Webpage name}{Citation number}. Examples: \cit{Wikipedia - The French Revolution}{1} for the 1st unique citation, or \cit{BBC Article}{2} for the 2nd unique citation."
    details = "Use consecutive integers for every unique citation (going 1, 2, 3, ...). Use only this citation format regardless of what the source excerpts use. Remember you are citing the excerpts given to you - not THEIR citations, should they exist, which are irrelevant."

    return " ".join([base, web_example, details])

def get_video_citation_prompt():
    base = "VERY IMPORTANT: Always use a citation when possible."
    video_example = "To cite an excerpt, use the syntax: \cit{Time of nearest timestamp}{Citation number}. Examples: \cit{5:31}{1} for the 1st unique citation, or \cit{0:24}{2} for the 2nd unique citation."
    details = "Use consecutive integers for every unique citation (going 1, 2, 3, ...)."

    return " ".join([base, video_example, details])
