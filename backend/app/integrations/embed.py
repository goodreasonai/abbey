import os
from ..configs.secrets import OPENAI_API_KEY, OLLAMA_URL, OLLAMA_EMBEDS
import requests
import json
os.environ["OPENAI_API_KEY"] = OPENAI_API_KEY
from openai import OpenAI
openai_client = OpenAI()

class Embed():
    def __init__(self, code) -> None:
        self.code = code

    # Takes list of texts (strings) and returns an array of embeddings (i.e., list of lists)
    def embed(self, texts):
        raise Exception(f"Embedding function not implemented for model {self.code}")


class OpenAIEmbed(Embed):
    def __init__(self, openai_code, code) -> None:
        self.openai_code = openai_code
        super().__init__(
            code=code
        )

    def embed(self, texts):
        texts = [y.replace("\n", " ") for y in texts]
        return [y.embedding for y in openai_client.embeddings.create(input=texts, model=self.openai_code).data]


class OllamaEmbed(Embed):
    def __init__(self, ollama_code, code) -> None:
        self.ollama_code = ollama_code
        super().__init__(
            code=code
        )

    def embed(self, texts):
        texts = [y.replace("\n", " ") for y in texts]
        url = f'{OLLAMA_URL}/api/embed'
        data = {
            'model': self.ollama_code,
            'input': texts
        }
        response = requests.post(url, json=data)
        response.raise_for_status()
        my_json = response.json()
        return my_json['embeddings']


class OpenAIAda2(OpenAIEmbed):
    def __init__(self):
        super().__init__(
            openai_code="text-embedding-ada-002",
            code="openai-text-embedding-ada-002"
        )


class OpenAIEmbed3Small(OpenAIEmbed):
    def __init__(self):
        super().__init__(
            openai_code="text-embedding-3-small",
            code="openai-text-embedding-3-small"
        )


def gen_ollama_embeds():
    if not OLLAMA_URL or not OLLAMA_EMBEDS:
        return []
    
    ollama_embeds = json.loads(OLLAMA_EMBEDS)
    if not len(ollama_embeds):
        return []
    models = []
    for model in ollama_embeds:
        code = model['code']
        models.append(OllamaEmbed(
            ollama_code=code,
            code=f'{code}-ollama',
        ))
    return models

ollama_embeds = {x.code: x for x in gen_ollama_embeds()}

EMBED_PROVIDERS = {
    'openai-text-embedding-ada-002': OpenAIAda2(),
    'openai-text-embedding-3-small': OpenAIEmbed3Small(),
    **ollama_embeds
}

