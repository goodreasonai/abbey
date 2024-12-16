from ..configs.secrets import OPENAI_API_KEY, ANTHROPIC_API_KEY, OPENAI_COMPATIBLE_KEY
from ..configs.settings import SETTINGS
from ..utils import extract_from_base64_url
import os
import requests
import json

os.environ["OPENAI_API_KEY"] = OPENAI_API_KEY if OPENAI_API_KEY else ""
from openai import OpenAI
openai_client = OpenAI() if OPENAI_API_KEY else None
import anthropic
client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY) if ANTHROPIC_API_KEY else None


class LM():
    model: str = ""  # A code unique to the provider (OpenAI, Anthropic, Ollama, etc)
    code: str = ""  # A universally unique code across all providers (OpenAI, Anthropic, Ollama, etc)
    name: str = ""  # How users see the name presented
    desc: str = ""  # A description shown in Settings
    traits: str = ""  # A couple word description of strengths shown in Settings
    context_length: int  # in tokens
    accepts_images: bool  # can run and stream use images?
    supports_json: bool  # Does inference give a guarantee of correct JSON if requested?
    def __init__(self, model, code, name, desc, traits, context_length, accepts_images=False, supports_json=False) -> None:
        self.model = model
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
            extra_kwargs['temperature'] = temperature

        if make_json and self.supports_json:
            extra_kwargs['response_format'] = {'type': 'json_object'}
        
        completion = openai_client.chat.completions.create(model=self.model, messages=messages, stream=False, **extra_kwargs)
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

        completion = openai_client.chat.completions.create(model=self.model, messages=messages, stream=True, **extra_kwargs)
        for chunk in completion:
            if chunk.choices[0].delta.content is not None:
                yield chunk.choices[0].delta.content


class Anthropic(LM):

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
                'temperature': temperature if temperature else .7,
                'num_ctx': self.context_length
            },
            'stream': False
        }
        ollama_url = SETTINGS['ollama']['url']
        url = f'{ollama_url}/api/chat'
        response = requests.post(url, json=params, stream=False)
        response.raise_for_status()  # Raise an error for bad responses
        my_json = response.json()
        x = my_json['message']['content']
        return x

    def stream(self, txt, system_prompt=None, context=[], temperature=None, images=[]):
        params = {
            'model': self.model,
            'messages': self._make_messages(txt, system_prompt=system_prompt, context=context, images=images),
            'options': {
                'temperature': temperature if temperature else .7,
                'num_ctx': self.context_length
            },
            'stream': True
        }
        ollama_url = SETTINGS['ollama']['url']
        url = f'{ollama_url}/api/chat'
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


class OpenAICompatibleLM(LM):

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
            extra_kwargs['temperature'] = temperature

        if make_json and self.supports_json:
            extra_kwargs['response_format'] = {'type': 'json_object'}
        
        params = {
            'model': self.model,
            'messages': messages,
            'temperature': temperature if temperature else .7,
            'stream': False
        }
        oai_compatible_url = SETTINGS['openai_compatible']['url']
        url = f'{oai_compatible_url}/v1/chat/completions'
        response = requests.post(url, headers={'Authorization': f'Bearer {OPENAI_COMPATIBLE_KEY}'}, json=params, stream=False)
        response.raise_for_status()  # Raise an error for bad responses
        my_json = response.json()
        return my_json['choices'][0]['message']['content']
        

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

        params = {
            'model': self.model,
            'messages': messages,
            'temperature': temperature if temperature else .7,
            'stream': True
        }

        oai_compatible_url = SETTINGS['openai_compatible']['url']
        url = f'{oai_compatible_url}/v1/chat/completions'
        response = requests.post(url, headers={'Authorization': f'Bearer {OPENAI_COMPATIBLE_KEY}'}, json=params, stream=True)
        response.raise_for_status()  # Raise an error for bad responses

        # Process the streaming response
        for line in response.iter_lines():
            if line:
                data = line.decode('utf-8')
                real_data = data[len('data: '):]
                if real_data == '[DONE]':
                    break
                my_json = json.loads(real_data)
                delta = my_json['choices'][0]['delta']
                if 'content' in delta:
                    yield delta['content']


PROVIDER_TO_LM = {
    'ollama': Ollama,
    'openai': OpenAILM,
    'anthropic': Anthropic,
    'openai_compatible': OpenAICompatibleLM
}


# Creates a universal code based on the settings entry
# Used both in generate defaults and user_config to give a predictable ordering of models to the user.
def make_code_from_setting(lm):
    model = lm['model']
    provider = lm['provider']
    return lm['code'] if 'code' in lm else model + f"-{provider}"


"""
Settings look like:

lms:
  models:
    - provider: openai  # required
      model: "gpt-4o"  # required
      context_length: 100000  # optional (defaults to 4096)
      name: "GPT-4o"  # optional
      supports_json: true  # optional
      accepts_images: true  # optional
      desc: "One of the best models ever!"  # optional
      code: "gpt-4o"  # optional
      disabled: false  # optional

"""
def generate_lms():
    DEFAUlT_CONTEXT_LENGTH = 8192
    to_return = {}
    lms = SETTINGS['lms']['models']
    for lm in lms:
        if 'disabled' in lm and lm['disabled']:
            continue
        provider = lm['provider']
        provider_class = PROVIDER_TO_LM[provider]
        model = lm['model']
        code = make_code_from_setting(lm)
        name = lm['name'] if 'name' in lm else model
        context_length = lm['context_length'] if 'context_length' in lm else DEFAUlT_CONTEXT_LENGTH
        traits = lm['traits'] if 'traits' in lm else ""
        supports_json = lm['supports_json'] if 'supports_json' in lm else False
        accepts_images = lm['accepts_images'] if 'accepts_images' in lm else False
        desc = lm['desc'] if 'desc' in lm else f"The model {model} provided by {provider} has a context length of {context_length}."
        obj = provider_class(
            model=model,
            code=code,
            name=name,
            desc=desc,
            traits=traits,
            context_length=context_length,
            supports_json=supports_json,
            accepts_images=accepts_images
        )
        to_return[code] = obj
    return to_return


LM_PROVIDERS = generate_lms()

def generate_defaults():
    defaults = SETTINGS['lms']['defaults'] if 'defaults' in SETTINGS['lms'] else {}
    to_return = {}

    lms = SETTINGS['lms']['models']
    first_available = make_code_from_setting(lms[0])
    longest_context = max(LM_PROVIDERS.values(), key=lambda x: x.context_length).code
    
    to_return['DEFAULT_CHAT_MODEL'] = defaults['chat'] if 'chat' in defaults else first_available  # Use specified, else use first available
    to_return['HIGH_PERFORMANCE_CHAT_MODEL'] = defaults['high_performance'] if 'high_performance' in defaults else to_return['DEFAULT_CHAT_MODEL']  # Use specified else use default chat model
    
    to_return['BALANCED_CHAT_MODEL'] = defaults['balanced'] if 'balanced' in defaults else to_return['DEFAULT_CHAT_MODEL']  # Use specified else use default chat model
    to_return['FAST_CHAT_MODEL'] = defaults['fast'] if 'fast' in defaults else to_return['DEFAULT_CHAT_MODEL']  # Use specified else use default chat model
    to_return['LONG_CONTEXT_CHAT_MODEL'] = defaults['long_context'] if 'long_context' in defaults else longest_context  # Use specified else use default chat model
    to_return['FAST_LONG_CONTEXT_MODEL'] = defaults['fast_long_context'] if 'fast_long_context' in defaults else to_return['LONG_CONTEXT_CHAT_MODEL']  # Use specified else use long context model
    to_return['ALT_LONG_CONTEXT_MODEL'] = defaults['alt_long_context'] if 'alt_long_context' in defaults else to_return['LONG_CONTEXT_CHAT_MODEL']  # Use specified else use long context model

    return to_return

_defaults = generate_defaults()
DEFAULT_CHAT_MODEL = _defaults['DEFAULT_CHAT_MODEL']
HIGH_PERFORMANCE_CHAT_MODEL = _defaults['HIGH_PERFORMANCE_CHAT_MODEL']
BALANCED_CHAT_MODEL = _defaults['BALANCED_CHAT_MODEL']
FAST_CHAT_MODEL = _defaults['FAST_CHAT_MODEL']
LONG_CONTEXT_CHAT_MODEL = _defaults['LONG_CONTEXT_CHAT_MODEL']
FAST_LONG_CONTEXT_MODEL = _defaults['FAST_LONG_CONTEXT_MODEL']
ALT_LONG_CONTEXT_MODEL = _defaults['ALT_LONG_CONTEXT_MODEL']


"""

Percentage of context length that should be used for retrieval in various places in the code base.

Not necessarily used in non chat retrieval contexts.

Can / should be changed based on typical model behavior and speed.

Sample outputs:
- 5_000 -> 2_500
- 10_000 -> 7_000
- 32_000 -> 23_500
- 100_000 -> 57_500
- 200_000 -> 107_500

"""
def get_safe_retrieval_context_length(model: LM):
    # Works like tax brackets
    brackets = [
        (5_000, .5),  # 50% of the first 5000 tokens
        (10_000, .9),  # 90% of tokens 5000-10000
        (32_000, .75),  # etc
        (100_000, .5)
    ]
    cl_remaining = model.context_length
    safety_cl = 0
    prev = 0
    for bracket in brackets:
        overlap = min(cl_remaining, bracket[0] - prev)
        contribution = overlap * bracket[1]
        safety_cl += contribution
        cl_remaining -= bracket[0] - prev
        prev = bracket[0]
        if cl_remaining <= 0:
            break
    
    if cl_remaining > 0:
        safety_cl += cl_remaining * brackets[-1][1]

    return round(safety_cl)
