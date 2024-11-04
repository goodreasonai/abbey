import os
from ..configs.secrets import OPENAI_API_KEY
os.environ["OPENAI_API_KEY"] = OPENAI_API_KEY
from openai import OpenAI
openai_client = OpenAI()

class Embed():
    def __init__(self, code) -> None:
        self.code = code

    # Takes list of texts (strings) and returns an array of embeddings
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


EMBED_PROVIDERS = {
    'openai-text-embedding-ada-002': OpenAIAda2(),
    'openai-text-embedding-3-small': OpenAIEmbed3Small()
}

