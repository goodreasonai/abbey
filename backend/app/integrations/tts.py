from .file_loaders import TextSplitter
import os
import requests
import sys
from ..configs.settings import SETTINGS
from ..configs.secrets import ELEVEN_LABS_API_KEY, OPENAI_API_KEY, OPENAI_COMPATIBLE_KEY
os.environ["OPENAI_API_KEY"] = OPENAI_API_KEY if OPENAI_API_KEY else ""
from openai import OpenAI
openai_client = OpenAI() if OPENAI_API_KEY else None

class TTS():
    voice: str = ""  # An identifier specific to the provider and model (like "onyx" for openai)
    model: str = ""  # An identifier specific to the provider (like "tts-1" for openai)
    code: str = ""  # A universally unique identifier
    name: str = ""
    desc: str = ""
    traits: str = ""  # A couple word description of strengths
    sample_url: str = ""
    def __init__(self, voice, model, code, name, desc, traits, sample_url) -> None:
        self.voice = voice
        self.model = model
        self.code = code
        self.name = name
        self.desc = desc
        self.traits = traits
        self.sample_url = sample_url

    def run(self, txt, speed=1.0):
        raise NotImplementedError(f"Run not impelemented for TTS model {self.code}")

    # Returns (extension, generator) tuple
    def stream(self, txt, speed=1.0):
        raise NotImplementedError(f"Stream not impelemented for TTS model {self.code}")

    # Returns value in seconds
    def estimate(self, txt):
        return .06 * len(txt)  # based on a sample audio from OpenAI Onyx (March 2024)

    def to_json_obj(self):
        return {
            'code': self.code,
            'name': self.name,
            'desc': self.desc,
            'traits': self.traits,
            'sample_url': self.sample_url
        }


class OpenAICompatibleBaseTTS(TTS):
    def __init__(self, url, key, voice, model, code, name, desc, traits, sample_url="") -> None:
        self.url = url
        self.key = key
        super().__init__(
            voice=voice,
            model=model,
            code=code,
            name=name,
            desc=desc,
            traits=traits,
            sample_url=sample_url
        )

    def stream(self, txt, speed=1.0):
        speed = max(min(speed, 4.0), .25)  # based on API limitations
        
        url = f"{self.url}/v1/audio/speech"
        headers = {
            "Authorization": f'Bearer {self.key}',  # Replace with your API key
        }
        text_splitter = TextSplitter(
            max_chunk_size=2048,  # in characters, needs to be less than 4096. Lower values allow us to abort faster if the user stops listening.
            chunk_overlap=0,
            length_function=len
        )
        txts = text_splitter.split_text(txt)
        def to_stream():
            for split in txts:
                try:
                    data = {
                        "model": self.model,
                        "input": split,
                        "voice": self.voice,
                        "response_format": "mp3",
                        'speed': speed
                    }
                    with requests.post(url, headers=headers, json=data, stream=True) as response:
                        if response.status_code == 200:
                            for chunk in response.iter_content(chunk_size=4096):
                                yield chunk
                        else:
                            print(f"Error getting audio: {response.status_code} - {response.text}", file=sys.stderr)
                except Exception as e:
                    print(f"Error while making requests for audio: {e}", file=sys.stderr)
        return "mp3", to_stream()


class OpenAITTS(OpenAICompatibleBaseTTS):
    def __init__(self, voice, model, code, name, desc, traits, sample_url) -> None:
        super().__init__(
            url="https://api.openai.com",
            key=OPENAI_API_KEY,
            voice=voice,
            model=model,
            code=code,
            name=name,
            desc=desc,
            traits=traits,
            sample_url=sample_url
        )


class OpenAICompatibleTTS(OpenAICompatibleBaseTTS):
    def __init__(self, voice, model, code, name, desc, traits, sample_url) -> None:
        super().__init__(
            url=SETTINGS['openai_compatible']['url'],
            key=OPENAI_COMPATIBLE_KEY,
            voice=voice,
            model=model,
            code=code,
            name=name,
            desc=desc,
            traits=traits,
            sample_url=sample_url
        )


class ElevenLabs(TTS):
    def __init__(self, voice, model, code, name, desc, traits, sample_url) -> None:
        super().__init__(
            voice=voice,
            model=model,
            code=code,
            name=name,
            desc=desc,
            traits=traits,
            sample_url=sample_url
        )

    def stream(self, txt, speed=1.0):
        
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{self.voice}/stream"
        headers = {
            'Content-Type': 'application/json',
            'xi-api-key': ELEVEN_LABS_API_KEY
        }
        
        text_splitter = TextSplitter(
            max_chunk_size = 512,  # in characters, needs to be less than 4096. Lower values allow us to abort faster if the user stops listening.
            chunk_overlap = 0,
            length_function = len
        )
        txts = text_splitter.split_text(txt)

        def to_stream():
            for split in txts:
                data = {
                    "model_id": self.model,
                    "text": split
                }
                with requests.post(url, headers=headers, json=data, stream=True) as response:
                    if response.status_code == 200:
                        for chunk in response.iter_content(chunk_size=4096):
                            yield chunk
                    else:
                        print(f"Error getting audio: {response.status_code} - {response.text}", file=sys.stderr)
        return "mp3", to_stream()


PROVIDER_TO_TTS = {
    'openai': OpenAITTS,
    'eleven_labs': ElevenLabs,
    'openai_compatible': OpenAICompatibleTTS
}

def make_code_from_setting(tts):
    voice = tts['voice']
    model = tts['model']
    provider = tts['provider']
    return tts['code'] if 'code' in tts else f"{voice}-{model}-{provider}"

"""
Settings look like:

tts:
  voices:
    - provider: openai  # required
      voice: "onyx"  # required
      model: "tts-1"
      name: "Onyx"  # optional
      desc: "One of the best models ever!"  # optional
      code: "openai_onyx"  # optional
      sample_url: "https://public-audio-samples.s3.amazonaws.com/onyx.wav"
      disabled: false  # optional

"""
def generate_tts():
    if 'tts' not in SETTINGS:
        return {}
    if 'voices' not in SETTINGS['tts'] or not len(SETTINGS['tts']['voices']):
        return {}
    
    to_return = {}
    options = SETTINGS['tts']['voices']
    for option in options:
        if 'disabled' in option and option['disabled']:
            continue
        provider = option['provider']
        provider_class = PROVIDER_TO_TTS[provider]
        voice = option['voice']
        model = option['model']
        code = make_code_from_setting(option)
        name = option['name'] if 'name' in option else voice
        traits = option['traits'] if 'traits' in option else provider
        desc = option['desc'] if 'desc' in option else f"This voice uses the model {model} and is provided by {provider}."
        sample_url = option['sample_url'] if 'sample_url' in option else ""
        obj = provider_class(
            voice=voice,
            model=model,
            code=code,
            name=name,
            desc=desc,
            traits=traits,
            sample_url=sample_url
        )
        to_return[code] = obj
    return to_return


TTS_PROVIDERS = generate_tts()


def generate_default():
    if 'tts' not in SETTINGS:
        return ""
    if 'voices' not in SETTINGS['tts'] or not len(SETTINGS['tts']['voices']):
        return ""
    
    voices = SETTINGS['tts']['voices']

    if 'default' in SETTINGS['tts']:
        return SETTINGS['tts']['default']
    
    return make_code_from_setting(voices[0])  # first available 


DEFAULT_TTS_MODEL = generate_default()
