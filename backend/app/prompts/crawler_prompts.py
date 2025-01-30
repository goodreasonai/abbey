
def get_suggest_from_topic_system(n=5):
    intro = f"Your task is to write about {n} search queries such as those that might appear in Google or Bing. Queries might also be put into a special search engine like Reddit or arXiv."
    body = "The queries you write must be in service of a research goal, which will be provided by the user. You should be creative. You might, for example, write queries that could accomplish subgoals within the research topic or lead to surprising new paths. You should use your background knowledge to determine what you might mention in the query."
    formatting = "You must write your queries in this JSON schema: {\"queries\": [...]}."
    return " ".join([intro, body, formatting])


# Qualities is a list of ScrapeQuality objects with "code", "name", "desc"
def get_scrape_quality_system(qualities):
    intro = f"Your task is to determine the quality of the user's web scrape. The user's computer went to a website and took recorded data that may or may not be complete."
    quality_text = "You are asked to determine the code most aligned with the quality of the scrape. Here are the codes you can use:"
    codes = "\n".join([f"Name: {q.name}. Code: {q.code}. Description: {q.desc}" for q in qualities])
    formatting = "You must respond in a JSON format in the style: {\"quality_code\": \"CODE\"}. Output ONLY the well-formatted JSON."
    return "\n\n".join([intro, quality_text, codes, formatting])


def get_scrape_quality_user_text(url, text):
    intro = f"I attempted to scrape the URL {url}. The collected text from the website/file is below:"
    return "\n\n".join([intro, text])


def get_scrape_quality_user(url):
    intro = f"I attempted to scrape the URL {url}. Attached is the collected data."
    return intro


def get_eval_system(source_types, topic, max_trustworthiness, max_relevance):
    intro = "Your task is to do a basic evaluation of the user provided source. The user scraped this source from online and now needs to determine its relevance to his needs."
    instructions = "Here are the following items you must output:"
    items = [
        "Title: You should infer a title from the source",
        "Author: You should make a guess as to the author, which can be a person, group, or organization",
        "Description: You should give a brief 1 sentence description of the content of the source",
        "Source type code: You should give a code representing the type of source that was collected (see below for details).",
        f"Trustworthiness: Give a score, 1-{max_trustworthiness}, representing how trustworthy the source might be; for example, shady news outlets are worse than high quality ones. Primary sources are high ({max_trustworthiness}). Sketchy blog posts are low (1).",
        f"Relevance: Give a score, 1-{max_relevance}, representing how relevant the source is to the research topic. Note that while the source may not address the topic directly, it may still provide important background on key people or subgoals. See the topic below."
    ]
    items_text = "\n".join(items)
    source_type_instructions = "For the source type, here are the codes you may use:"
    source_type_list = "\n".join([f"{x.code}: {x.name}, {x.desc}" for x in source_types])
    instruct_topic = f"Here is the research topic for scoring relevance:\n {topic}"
    format = "You must output well formatted JSON in the appropriate schema, an example of which is the following:"
    schema = """{
    "title": "My Source Title",
    "author": "My Author",
    "desc": "My brief 1 sentence description of the source.",
    "source_type_code": "GOV",
    "trustworthiness": 5,
    "relevance": 1
}
"""
    to_return = "\n\n".join([intro, instructions, items_text, source_type_instructions, source_type_list, instruct_topic, format, schema])
    return to_return


def get_eval_user(url, text):
    return f"Here is the source, which was scraped from {url}:\n\n{text}"
