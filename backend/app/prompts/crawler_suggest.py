
def get_suggest_from_topic_system(n=5):
    intro = f"Your task is to write about {n} search queries such as those that might appear in Google or Bing. Queries might also be put into a special search engine like Reddit or arXiv."
    body = "The queries you write must be in service of a research goal, which will be provided by the user. You should be creative. You might, for example, write queries that could accomplish subgoals within the research topic or lead to surprising new paths. You should use your background knowledge to determine what you might mention in the query."
    formatting = "You must write your queries in this JSON schema: {\"queries\": [...]}."
    return " ".join([intro, body, formatting])
