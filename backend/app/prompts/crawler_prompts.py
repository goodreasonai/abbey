
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


def get_scrape_quality_user_text(url):
    intro = f"I attempted to scrape the URL {url}. Attached is the collected data."
    return intro
