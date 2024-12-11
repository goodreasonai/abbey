import os
from ..configs.secrets import OPENAI_API_KEY, OPENAI_COMPATIBLE_EMBEDS, OPENAI_COMPATIBLE_KEY, OPENAI_COMPATIBLE_URL
from ..configs.settings import SETTINGS
import requests
import json
os.environ["OPENAI_API_KEY"] = OPENAI_API_KEY if OPENAI_API_KEY else ""
from openai import OpenAI
openai_client = OpenAI() if OPENAI_API_KEY else None

class Embed():
    def __init__(self, model, code) -> None:
        self.model = model
        self.code = code

    # Takes list of texts (strings) and returns an array of embeddings (i.e., list of lists)
    def embed(self, texts):
        raise Exception(f"Embedding function not implemented for model {self.code}")


class OpenAIEmbed(Embed):
    # Note: OpenAI will throw an error if any text to embed is blank.
    def embed(self, texts):
        texts = [y.replace("\n", " ") for y in texts]  # Remove line breaks and replace with spaces before embedding
        return [y.embedding for y in openai_client.embeddings.create(input=texts, model=self.model).data]


class OllamaEmbed(Embed):

    def embed(self, texts):
        texts = [y.replace("\n", " ") for y in texts]
        ollama_url = SETTINGS['ollama']['url']
        url = f'{ollama_url}/api/embed'
        data = {
            'model': self.model,
            'input': texts
        }
        response = requests.post(url, json=data)
        response.raise_for_status()
        my_json = response.json()
        return my_json['embeddings']


class OpenAICompatibleEmbed(Embed):

    def embed(self, texts):
        texts = [y.replace("\n", " ") for y in texts]
        url = f'{OPENAI_COMPATIBLE_URL}/v1/embeddings'
        data = {
            'model': self.model,
            'input': texts
        }
        response = requests.post(url, headers={'Authorization': f'Bearer {OPENAI_COMPATIBLE_KEY}'}, json=data)
        response.raise_for_status()
        my_json = response.json()
        return [y['embedding'] for y in my_json['data']]


PROVIDER_TO_EMBED = {
    'ollama': OllamaEmbed,
    'openai': OpenAIEmbed,
    'openai_compatible': OpenAICompatibleEmbed
}


# Creates a universal code based on the settings entry
# Used both in generate defaults and user_config to give a predictable ordering of models to the user.
def make_code_from_setting(embed):
    model = embed['model']
    provider = embed['provider']
    return embed['code'] if 'code' in embed else model + f"-{provider}"


"""
Settings look like:

embeds:
  - provider: openai  # required
    model: "text-embedding-ada-002"  # required
    code: "ada-2"  # optional

"""
def generate_embeds():
    to_return = {}
    embeds = SETTINGS['embeds']['models']
    for embed in embeds:
        if 'disabled' in embed and embed['disabled']:
            continue
        provider = embed['provider']
        provider_class = PROVIDER_TO_EMBED[provider]
        model = embed['model']
        code = make_code_from_setting(embed)
        obj = provider_class(
            model=model,
            code=code,
        )
        to_return[code] = obj
    return to_return


EMBED_PROVIDERS = generate_embeds()

def generate_default():
    default = SETTINGS['embeds']['default'] if 'default' in SETTINGS['embeds'] else ""
    if default:
        return default

    embeds = SETTINGS['embeds']['models']
    first_available = make_code_from_setting(embeds[0])
    return first_available

DEFAULT_EMBEDDING_OPTION = generate_default()
