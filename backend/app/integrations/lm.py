import warnings
from ..configs.secrets import OPENAI_API_KEY, ANTHROPIC_API_KEY, OLLAMA_URL
from ..utils import extract_from_base64_url
import os
import requests
import json

os.environ["OPENAI_API_KEY"] = OPENAI_API_KEY
from openai import OpenAI
openai_client = OpenAI()
import anthropic
client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)


class LM():
    code: str = ""
    name: str = ""  # How users see the name presented
    desc: str = ""
    traits: str = ""  # A couple word description of strengths
    context_length: int  # in tokens
    accepts_images: bool
    supports_json: bool
    def __init__(self, code, name, desc, traits, context_length, accepts_images=False, supports_json=False) -> None:
        self.code = code
        self.name = name
        self.desc = desc
        self.traits = traits
        self.context_length = context_length
        self.accepts_images=accepts_images
        self.supports_json = supports_json

    def run(self, txt, system_prompt=None, context=[], make_json=False, temperature=None, images=[]):
        raise NotImplementedError(f"Run not impelemented for language model {self.code}")

    def stream(self, txt, system_prompt=None, context=[], temperature=None, images=[]):
        raise NotImplementedError(f"Stream not impelemented for language model {self.code}")

    def to_json_obj(self):
        return {
            'code': self.code,
            'name': self.name,
            'desc': self.desc,
            'traits': self.traits,
            'accepts_images': self.accepts_images,
            'context_length': self.context_length,
            'supports_json': self.supports_json
        }


class OpenAILM(LM):
    def __init__(self, openai_code, code, name, desc, traits, context_length, supports_json=False, accepts_images=False) -> None:
        self.openai_code = openai_code
        self.supports_json=supports_json
        super().__init__(
            code=code,
            name=name,
            desc=desc,
            traits=traits,
            context_length=context_length,
            supports_json=supports_json,
            accepts_images=accepts_images
        )

    def _make_messages(self, txt, system_prompt=None, context=[], images=[]):
        messages = []
        messages.append({'role': 'system', 'content': system_prompt if system_prompt is not None else ""})

        for round in context:
            if 'images' in round and round['images'] and len(round['images']) and self.accepts_images:
                # Note that the "image_url" is actually a base64 string with data:image/png;base64,...
                messages.append({'role': 'user', 'content': [{'type': 'text', 'text': round['user']}, *[{'type': 'image_url', 'image_url': {'url': x}} for x in round['images']]]})
            else:
                messages.append({'role': 'user', 'content': round['user']})
            messages.append({'role': 'assistant', 'content': round['ai']})

        if images is not None and self.accepts_images and len(images):
            messages.append({'role': 'user', 'content': [{'type': 'text', 'text': txt}, *[{'type': 'image_url', 'image_url': {'url': x}} for x in images]]})
        else:
            messages.append({'role': 'user', 'content': txt})

        return messages


    def run(self, txt, system_prompt=None, context=[], temperature=.7, make_json=False, images=[]):

        messages = self._make_messages(
            txt=txt,
            system_prompt=system_prompt,
            context=context,
            images=images
        )

        extra_kwargs = {}
        if temperature is not None:
            if temperature > 1:
                warnings.warn("Temperature in request found to be above 1; this is not recommended.")
                temperature = 1.0
            if temperature < 0:
                warnings.warn("Temperature can't go below zero!")
                temperature = 0.0
            extra_kwargs['temperature'] = temperature

        if make_json and self.supports_json:
            extra_kwargs['response_format'] = {'type': 'json_object'}
        
        completion = openai_client.chat.completions.create(model=self.openai_code, messages=messages, stream=False, **extra_kwargs)
        return completion.choices[0].message.content


    def stream(self, txt, system_prompt=None, context=[], temperature=None, images=[]):
       
        messages = self._make_messages(
            txt=txt,
            system_prompt=system_prompt,
            context=context,
            images=images
        )

        extra_kwargs = {}
        if temperature is not None:
            extra_kwargs['temperature'] = temperature

        completion = openai_client.chat.completions.create(model=self.openai_code, messages=messages, stream=True, **extra_kwargs)
        for chunk in completion:
            if chunk.choices[0].delta.content is not None:
                yield chunk.choices[0].delta.content


class Anthropic(LM):
    def __init__(self, model, code, name, desc, traits, context_length, supports_json=False, accepts_images=False) -> None:
        self.model = model
        super().__init__(
            code=code,
            name=name,
            desc=desc,
            traits=traits,
            context_length=context_length,
            supports_json=supports_json,
            accepts_images=accepts_images
        )

    def _make_messages(self, txt, system_prompt=None, context=[], images=[]):
        messages = []

        def get_images_content(imgs):
            image_content = []
            for x in imgs:
                media_type, img_data = extract_from_base64_url(x)
                image_content.append({'type': 'image', 'source': {'type': 'base64', 'media_type': media_type, 'data': img_data}})
            return image_content

        for round in context:
            if 'images' in round and round['images'] and len(round['images']) and self.accepts_images:
                messages.append(
                    {
                        'role': 'user', 
                        'content': [
                            {'type': 'text', 'text': round['user']},
                            *get_images_content(round['images'])
                        ]
                    }
                )
            else:
                messages.append({'role': 'user', 'content': round['user']})
            messages.append({'role': 'assistant', 'content': round['ai']})

        if images is not None and self.accepts_images and len(images):
            messages.append(
                {
                    'role': 'user', 
                    'content': [
                        {'type': 'text', 'text': txt},
                        *get_images_content(images)
                    ]
                }
            )
        else:
            messages.append({'role': 'user', 'content': txt})

        return messages


    def run(self, txt, system_prompt=None, context=[], temperature=.7, make_json=False, images=[]):
        
        messages = self._make_messages(
            txt=txt,
            system_prompt=system_prompt,
            context=context,
            images=images
        )

        if temperature is None:
            temperature = .7

        if system_prompt is None:
            system_prompt = ""

        if make_json:
            messages.append({'role': 'assistant', 'content': '{"'})  # best we can do - just starting the thing off with {" (NOTE: inverse at bottom!)

        # Max content window is 200k for claude 3
        message = client.messages.create(
            max_tokens=4096,  # max output tokens?
            messages=messages,
            model=self.model,
            temperature=temperature,
            system=system_prompt
        )
        
        resp = message.content[0].text

        if make_json:
            resp = '{"' + resp

        return resp

    def stream(self, txt, system_prompt=None, context=[], temperature=None, images=[]):
        messages = self._make_messages(
            txt=txt,
            system_prompt=system_prompt,
            context=context,
            images=images
        )

        if temperature is None:
            temperature = .7

        if system_prompt is None:
            system_prompt = ""

        # Max content window is 200k for claude 3
        with client.messages.stream(
            max_tokens=4096,  # max output tokens?
            messages=messages,
            model=self.model,
            temperature=temperature,
            system=system_prompt
        ) as stream:
            for text in stream.text_stream:
                yield text


class Ollama(LM):
    def __init__(self, ollama_code, code, name, desc, traits, context_length, supports_json=True, accepts_images=False) -> None:
        self.model = ollama_code
        super().__init__(
            code=code,
            name=name,
            desc=desc,
            traits=traits,
            context_length=context_length,
            supports_json=supports_json,
            accepts_images=accepts_images
        )

    def _make_messages(self, txt, system_prompt=None, context=[], images=[]):
        messages = []

        if system_prompt:
            messages.append({
                'role': 'system',
                'content': system_prompt
            })

        def get_images_content(imgs):
            image_content = []
            for x in imgs:
                _, img_data = extract_from_base64_url(x)
                image_content.append(img_data)
            return image_content

        for round in context:
            messages.append({
                'role': 'user', 
                'content': round['user'],
                'images': get_images_content(round['images']) if 'images' in round and round['images'] and len(round['images']) and self.accepts_images else None
            })
            messages.append({'role': 'assistant', 'content': round['ai']})

        messages.append({
            'role': 'user', 
            'content': txt,
            'images': get_images_content(round['images']) if images is not None and self.accepts_images and len(images) else None
        })
        return messages

    def run(self, txt, system_prompt=None, context=[], temperature=.7, make_json=False, images=[]):
        messages = self._make_messages(txt, system_prompt=system_prompt, context=context, images=images)
        params = {
            'model': self.model,
            'messages': messages,
            'options': {
                'temperature': temperature if temperature else .7
            },
            'stream': False
        }
        url = f'{OLLAMA_URL}/api/chat'
        try:
            response = requests.post(url, json=params, stream=False)
            response.raise_for_status()  # Raise an error for bad responses
            my_json = response.json()
            x = my_json['message']['content']
            return x

        except requests.exceptions.RequestException as e:
            print(f"An error occurred: {e}")

    def stream(self, txt, system_prompt=None, context=[], temperature=None, images=[]):
        params = {
            'model': self.model,
            'messages': self._make_messages(txt, system_prompt=system_prompt, context=context, images=images),
            'options': {
                'temperature': temperature if temperature else .7
            },
            'stream': True
        }
        url = f'{OLLAMA_URL}/api/chat'
        try:
            response = requests.post(url, json=params, stream=True)
            response.raise_for_status()  # Raise an error for bad responses

            # Process the streaming response
            for line in response.iter_lines():
                if line:
                    # Assuming each line is a JSON object
                    data = line.decode('utf-8')
                    my_json = json.loads(data)
                    # Process the data as needed
                    yield my_json['message']['content']

        except requests.exceptions.RequestException as e:
            print(f"An error occurred: {e}")



class GPT4(OpenAILM):
    def __init__(self) -> None:
        super().__init__(
            openai_code='gpt-4',
            code='gpt-4',
            name='GPT-4',
            desc='GPT-4 is among the most powerful models of intelligence on the planet.',
            traits="Smart",
            context_length=8_192,
            supports_json=True,
            accepts_images=False
        )


class GPT4o(OpenAILM):
    def __init__(self) -> None:
        super().__init__(
            openai_code='gpt-4o',
            code='gpt-4o',
            name='GPT-4o',
            desc='GPT-4o is a flagship model from OpenAI, which is very fast, very smart, and natively multimodal.',
            traits="Very Smart and Fast",
            context_length=128_000,
            supports_json=True,
            accepts_images=True
        )


class GPT35Turbo(OpenAILM):
    def __init__(self) -> None:
        super().__init__(
            openai_code='gpt-3.5-turbo',
            code='gpt-3.5-turbo',
            name='GPT-3.5 Turbo',
            desc="GPT 3.5 is fast and often adequate for straightforward document Q&A.",
            traits="Fast",
            context_length=16_385,
            supports_json=True,
            accepts_images=False
        )


class GPT4Turbo(OpenAILM):
    def __init__(self) -> None:
        super().__init__(
            openai_code='gpt-4-turbo',
            code='gpt-4-turbo',
            name='GPT-4 Turbo',
            desc="GPT 4 Turbo sits between 3.5 and 4 for speed and intelligence, so some argue that it is faster than 4.",
            traits="Smart and Fast",
            context_length=128_000,
            supports_json=True,
            accepts_images=True
        )


class GPT4oMini(OpenAILM):
    def __init__(self) -> None:
        super().__init__(
            openai_code='gpt-4o-mini',
            code='gpt-4o-mini',
            name='GPT-4o Mini',
            desc="GPT 4o mini is slim and fast.",
            traits="Fast",
            context_length=128_000,
            supports_json=True,
            accepts_images=True
        )


class O1Preview(OpenAILM):
    def __init__(self) -> None:
        super().__init__(
            openai_code='o1-preview',
            code='o1-preview',
            name='O1 Preview',
            desc="O1 is an experimental, slow, but highlly intelligent model by OpenAI.",
            traits="Slow and Smart",
            context_length=128_000,
            supports_json=True,
            accepts_images=True
        )


class O1Mini(OpenAILM):
    def __init__(self) -> None:
        super().__init__(
            openai_code='o1-mini',
            code='o1-mini',
            name='O1 Mini',
            desc="O1 Mini is an experimental, slow, but highlly intelligent model by OpenAI. It is smaller and faster than O1 Preview.",
            traits="Slow and Smart",
            context_length=128_000,
            supports_json=True,
            accepts_images=True
        )


class Claude3Opus(Anthropic):
    def __init__(self) -> None:
        super().__init__(
            model='claude-3-opus-latest',
            code='claude-3-opus',
            name='Claude 3 Opus',
            desc="Released in early 2024, Opus was the first broadly available non-OpenAI model to rival GPT-4 in intelligence.",
            traits="Smart",
            context_length=200_000,
            supports_json=True,
            accepts_images=True
        )


class Claude35Sonnet(Anthropic):
    def __init__(self) -> None:
        super().__init__(
            model='claude-3-5-sonnet-20240620',
            code='claude-3-5-sonnet',
            name='Claude 3.5 Sonnet',
            desc="It is powerful iteration of the intermediate level model in the latest Claude 3.5 lineup, rivaling GPT-4o. It is especially good for writing code.",
            traits="Coding",
            context_length=200_000,
            supports_json=True,
            accepts_images=True
        )


class Llama32_Ollama(Ollama):
    def __init__(self) -> None:
        super().__init__(
            ollama_code='llama3.2',
            code='llama-3-2-ollama',
            name='Llama 3.2',
            desc='Llama 3.2 is an open source edge model from Meta designed to run on consumer hardware.',
            traits="Slim",
            context_length=128_000,
            supports_json=True,
            accepts_images=False
        )



LM_PROVIDERS = {
    'gpt-4': GPT4(),
    'gpt-4o-mini': GPT4oMini(),
    'gpt-4-turbo': GPT4Turbo(),
    'claude-3-opus': Claude3Opus(),
    'claude-3-5-sonnet': Claude35Sonnet(),
    'gpt-4o': GPT4o(),
    'llama-3-2-ollama': Llama32_Ollama(),
    # o1-preview and o1-mini don't yet support system prompts, images, and streaming - so they are disabled in user_config.
    'o1-preview': O1Preview(),
    'o1-mini': O1Mini()
}

