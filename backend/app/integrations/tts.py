from .file_loaders import TextSplitter
import os
import requests
import sys
import json
from ..configs.secrets import ELEVEN_LABS_API_KEY, OPENAI_API_KEY, OPENAI_COMPATIBLE_URL, OPENAI_COMPATIBLE_KEY, OPENAI_COMPATIBLE_TTS
os.environ["OPENAI_API_KEY"] = OPENAI_API_KEY if OPENAI_API_KEY else ""
from openai import OpenAI
openai_client = OpenAI() if OPENAI_API_KEY else None

class TTS():
    code: str = ""
    name: str = ""
    desc: str = ""
    traits: str = ""  # A couple word description of strengths
    sample_url: str = ""
    def __init__(self, code, name, desc, traits, sample_url) -> None:
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
    

class OpenAITTS(TTS):
    def __init__(self, code, name, desc, traits, sample_url) -> None:
        super().__init__(
            code=code,
            name=name,
            desc=desc,
            traits=traits,
            sample_url=sample_url
        )

    def stream(self, txt, speed=1.0, voice="alloy", hd=False):
        
        speed = max(min(speed, 4.0), .25)  # based on API limitations
        
        url = "https://api.openai.com/v1/audio/speech"
        headers = {
            "Authorization": f'Bearer {OPENAI_API_KEY}',  # Replace with your API key
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
                        "model": 'tts-1' if not hd else "tts-1-hd",
                        "input": split,
                        "voice": voice,
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


class OpenAICompatibleTTS(TTS):
    def __init__(self, voice, code, name, desc, traits, sample_url="") -> None:
        self.voice = voice
        super().__init__(
            code=code,
            name=name,
            desc=desc,
            traits=traits,
            sample_url=sample_url
        )

    def stream(self, txt, speed=1.0, hd=False):
        speed = max(min(speed, 4.0), .25)  # based on API limitations
        
        url = f"{OPENAI_COMPATIBLE_URL}/v1/audio/speech"
        headers = {
            "Authorization": f'Bearer {OPENAI_COMPATIBLE_KEY}',  # Replace with your API key
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
                        "model": 'tts-1' if not hd else "tts-1-hd",
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


class ElevenLabs(TTS):
    def __init__(self, code, name, desc, traits, sample_url) -> None:
        super().__init__(
            code=code,
            name=name,
            desc=desc,
            traits=traits,
            sample_url=sample_url
        )
            

    def stream(self, txt, speed=1.0, voice_id="pNInz6obpgDQGcFmaJgB", model_id="eleven_multilingual_v2"):
        
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream"
        headers = {
            'Content-Type': 'application/json',
            'xi-api-key': ELEVEN_LABS_API_KEY
        }
        
        text_splitter = TextSplitter(
            chunk_size = 512,  # in characters, needs to be less than 4096. Lower values allow us to abort faster if the user stops listening.
            chunk_overlap = 0,
            length_function = len
        )
        txts = text_splitter.split_text(txt)

        def to_stream():
            for split in txts:
                data = {
                    "model_id": model_id,
                    "text": split
                }
                with requests.post(url, headers=headers, json=data, stream=True) as response:
                    if response.status_code == 200:
                        for chunk in response.iter_content(chunk_size=4096):
                            yield chunk
                    else:
                        print(f"Error getting audio: {response.status_code} - {response.text}", file=sys.stderr)
        return "mp3", to_stream()


class ElevenAdam(ElevenLabs):
    def __init__(self) -> None:
        super().__init__(
            code="eleven_adam",
            name="Adam",
            desc="A popular male American narrative voice",
            traits="Narrator",
            sample_url="https://public-audio-samples.s3.amazonaws.com/ElevenAdam.mp3"
        )

    def stream(self, *args, **kwargs):
        return super().stream(*args, **kwargs, model_id="eleven_multilingual_v2", voice_id="pNInz6obpgDQGcFmaJgB")


class Fable(OpenAITTS):
    def __init__(self) -> None:
        super().__init__(
            code='openai_fable',
            name='Fable',
            desc='A British storytelling voice from OpenAI',
            traits='British Storytime',
            sample_url='https://public-audio-samples.s3.amazonaws.com/fable.wav'
        )

    def stream(self, *args, **kwargs):
        return super().stream(*args, **kwargs, voice='fable')


class Onyx(OpenAITTS):
    def __init__(self) -> None:
        super().__init__('openai_onyx', 'Onyx', 'A deep and boring storytelling voice from OpenAI', 'American Calm', 'https://public-audio-samples.s3.amazonaws.com/onyx.wav')

    def stream(self, *args, **kwargs):
        return super().stream(*args, **kwargs, voice='onyx')


def gen_openai_compatible_tts():

    if not OPENAI_COMPATIBLE_URL or not OPENAI_COMPATIBLE_TTS:
        return []
    
    openai_compatible_tts = json.loads(OPENAI_COMPATIBLE_TTS)
    if not len(openai_compatible_tts):
        return []

    # TODO: confirm that all the models are downloaded / available.
    models = []
    for model in openai_compatible_tts:
        voice = model['voice']
        models.append(OpenAICompatibleTTS(
            voice=voice,
            code=f'{voice}-oai-compatible',
            name=voice,
            desc=f'{voice} is running via an OpenAI Compatible API',
            traits="API",
        ))
    return models

openai_compatible_models = {x.code: x for x in gen_openai_compatible_tts()}


TTS_PROVIDERS = {
    'openai_fable': Fable(),
    'openai_onyx': Onyx(),
    'eleven_adam': ElevenAdam(),
    **openai_compatible_models
}

