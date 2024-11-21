import os
from ..configs.secrets import OPENAI_API_KEY, OLLAMA_URL, OLLAMA_EMBEDS, OPENAI_COMPATIBLE_EMBEDS, OPENAI_COMPATIBLE_KEY, OPENAI_COMPATIBLE_URL
import requests
import json
os.environ["OPENAI_API_KEY"] = OPENAI_API_KEY if OPENAI_API_KEY else ""
from openai import OpenAI
openai_client = OpenAI() if OPENAI_API_KEY else None

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


class OpenAICompatibleEmbed(Embed):
    def __init__(self, model_code, code) -> None:
        self.model_code = model_code
        super().__init__(
            code=code
        )

    def embed(self, texts):
        texts = [y.replace("\n", " ") for y in texts]
        url = f'{OPENAI_COMPATIBLE_URL}/v1/embeddings'
        data = {
            'model': self.model_code,
            'input': texts
        }
        response = requests.post(url, headers={'Authorization': f'Bearer {OPENAI_COMPATIBLE_KEY}'}, json=data)
        response.raise_for_status()
        my_json = response.json()
        return [y['embedding'] for y in my_json['data']]


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


def gen_openai_compatible_embeds():
    if not OPENAI_COMPATIBLE_URL or not OPENAI_COMPATIBLE_EMBEDS:
        return []
    
    openai_compatible_embeds = json.loads(OPENAI_COMPATIBLE_EMBEDS)
    if not len(openai_compatible_embeds):
        return []
    models = []
    for model in openai_compatible_embeds:
        code = model['code']
        models.append(OpenAICompatibleEmbed(
            model_code=code,
            code=f'{code}-openai-compatible',
        ))
    return models

openai_compatible_embeds = {x.code: x for x in gen_openai_compatible_embeds()}


EMBED_PROVIDERS = {
    'openai-text-embedding-ada-002': OpenAIAda2(),
    'openai-text-embedding-3-small': OpenAIEmbed3Small(),
    **ollama_embeds,
    **openai_compatible_embeds
}

