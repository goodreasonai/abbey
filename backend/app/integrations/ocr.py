import requests
import time
from ..configs.secrets import MATHPIX_API_KEY, MATHPIX_API_APP
from ..configs.settings import SETTINGS
from ..utils import remove_ext
import json
import os
import sys

# NOTE: "OCR_PROVIDERS" variable at the bottom of the file

MATHPIX_OCR_MAX_WAIT = 10 * 60  # max wait time for mathpix OCR in seconds - remember though this uses exponetial fallback (see retriever.py)
MATHPIX_OCR_MAX_ATTEMPTS = 2  # Max number of times to retry OCR in failure

class OCR():
    def __init__(self, code, accept_formats) -> None:
        self.code = code  # unique, descriptive string associated with the model e.g., "mathpix" or "local"
        self.accept_formats = accept_formats  # the formats that do_ocr can accept e.g. ["pdf", "png"]

    # Returns path of new file that has readable text
    # Will raise an error if the OCR fails
    def do_ocr(self, ext, src_name) -> str:
        pass


class MathpixOCR(OCR):
    def __init__(self, code) -> None:
        self.img_formats = ["png", "jpeg", "jpg", "jpe", "bmp", "dib", "jp2", "webp", "pbm", "pgm", "ppm", "pxm", ".pnm", "pfm", "sr", "ras", "tiff", "tif", "exr", "hdr", "pic"]
        super().__init__(
            code=code,
            accept_formats = ["pdf", *self.img_formats]
        )


    def do_ocr(self, ext, src_name):
        if ext == 'pdf':
            return self._do_ocr_pdf(src_name)
        elif ext in self.img_formats:
            return self._do_ocr_image(src_name)
        else:
            raise Exception(f"Mathpix OCR does not work on file with extension '{ext}'.")


    def _do_ocr_pdf(self, src_name):
         # API: https://docs.mathpix.com/?shell#response-body-5
        headers = {
            'app_id': MATHPIX_API_APP,
            'app_key': MATHPIX_API_KEY
        }

        files = {
            'file': (src_name, open(src_name, 'rb')),
        }

        # Think about what formats you want...
        # This does markdown.
        
        desired_ext = ".abbeyjson"
        outname = remove_ext(src_name) + desired_ext
        data = {
            'options_json': json.dumps({
                'conversion_formats': {
                    'md': True,
                    'docx': False,
                    'tex.zip': False,
                    'html': False
                }
            })
        }

        init_attempts = 0
        while True:
            if init_attempts >= MATHPIX_OCR_MAX_ATTEMPTS - 1:
                raise Exception("Initial Mathpix OCR request max attempts exceeded.")

            response = requests.post(
                'https://api.mathpix.com/v3/pdf',
                headers=headers,
                files=files,
                data=data
            )

            if response.status_code == 200:
                my_json = response.json()
                pdf_id = my_json['pdf_id']
                tries = 0
                # Exponential decay
                while True:
                    
                    to_wait = 1.5**tries
                    if to_wait > MATHPIX_OCR_MAX_WAIT:
                        raise Exception("Mathpix got job, but processing exceeded max wait.")
                    time.sleep(to_wait)
                    
                    response = requests.get(
                        'https://api.mathpix.com/v3/pdf/' + str(pdf_id),
                        headers=headers
                    )

                    if response.status_code == 200:
                        my_json = response.json()

                        if my_json['status'] == 'completed':

                            response = requests.get(
                                'https://api.mathpix.com/v3/pdf/'+str(pdf_id)+'.lines.json', # desired_ext
                                headers=headers
                            )
                            
                            if response.status_code == 200:
                                my_json = response.json()
                                structured_data = {'pages': []}
                                for page in my_json['pages']:
                                    page_data = {'lines': []}
                                    for line in page['lines']:
                                        page_data['lines'].append(line['text'])
                                    structured_data['pages'].append(page_data)
                                
                                with open(outname, 'w') as f:
                                    json.dump(structured_data, f)

                                if outname != src_name:
                                    os.remove(src_name)
                                return outname
                            else:
                                raise Exception("Mathpix said it was completed, but fetching the file failed.")

                    tries += 1
                
            time.sleep(1)
            init_attempts += 1


    def _do_ocr_image(self, src_name):
        # API: https://docs.mathpix.com/?shell#response-body-5
        headers = {
            'app_id': MATHPIX_API_APP,
            'app_key': MATHPIX_API_KEY
        }

        files = {
            'file': (src_name, open(src_name, 'rb')),
        }

        # Think about what formats you want...
        # This does markdown.
        
        desired_ext = ".txt"
        outname = remove_ext(src_name) + desired_ext
        data = {
            'options_json': json.dumps({
                'math_inline_delimiters': ["$", "$"],
                'rm_spaces': False
            })
        }
        
        response = requests.post(
            'https://api.mathpix.com/v3/text',
            headers=headers,
            files=files,
            data=data
        )

        if response.status_code == 200:
            my_json = response.json()
            txt = my_json['text']
            with open(outname, 'w') as f:
                f.write(txt)
            
            if outname != src_name:
                os.remove(src_name)
            
            return outname
        
        raise Exception("Mathpix image api didn't return 200")


class DisabledOCR(OCR):
    def __init__(self, code) -> None:
        super().__init__(
            code=code,
            accept_formats = []
        )

    def do_ocr(self, ext, src_name):
        return src_name


PROVIDER_TO_OCR = {
    'mathpix': MathpixOCR
}

def make_code_from_setting(ocr):
    return ocr['code'] if 'code' in ocr else ocr['provider']

"""
Settings look like:

ocr:
  models:
    - provider: mathpix

"""
def generate_ocr():
    if 'ocr' not in SETTINGS:
        return {}
    if 'models' not in SETTINGS['ocr'] or not len(SETTINGS['ocr']['models']):
        return {}
    
    to_return = {}
    options = SETTINGS['ocr']['models']
    for option in options:
        if 'disabled' in option and option['disabled']:
            continue
        provider = option['provider']
        provider_class = PROVIDER_TO_OCR[provider]
        code = make_code_from_setting(option)
        obj = provider_class(
            code=code
        )
        to_return[code] = obj
    return to_return


OCR_PROVIDERS = {
    **generate_ocr(),
    'disabled': DisabledOCR('disabled'),
}

def generate_default():
    first_option: OCR = [x for x in OCR_PROVIDERS.values()][0]  # Is disabled if there's nothing specified
    if 'ocr' not in SETTINGS:
        return first_option.code
    if 'models' not in SETTINGS['ocr'] or not len(SETTINGS['ocr']['models']):
        return first_option.code

    if 'default' in SETTINGS['ocr']:
        default = SETTINGS['ocr']['default']
        if default not in OCR_PROVIDERS:
            print(f"\n\nWARNING: a default you specified, '{default}', does not exist. Make sure you're using the correct code schema as specified in the README. Instead, '{first_option.code}' will be used as the default.\n\n", file=sys.stderr)
        else:
            return default

    return first_option.code  # Since there was something specified but no default, the first option is no longer local but something else.

DEFAULT_OCR_OPTION = generate_default()
