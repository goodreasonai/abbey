from .curriculum import Curriculum
from .document import Document
from .classroom import Classroom
from .folder import Folder
from .detached_chat import DetachedChat
from .website import Website
from .quiz import Quiz
from .deprecated import Deprecated
from .text_editor import TextEditor
from .video import Video
from .infinite_quiz import InfiniteQuiz
from .section import Section
from .notebook import Notebook
import sys

# When adding a template, you must add an instantiation of it to the TEMPLATES list

TEMPLATES = [
    Document(),
    Classroom(),
    Folder(),
    DetachedChat(),
    Website(),
    Curriculum(),
    Quiz(),
    TextEditor(),
    Video(),
    InfiniteQuiz(),
    Notebook(),
    Section(),  # A derivative of Folder
]

def get_template_by_code(code):
    try:
        return [x for x in TEMPLATES if x.code == code][0]
    except IndexError:
        print(f"Returning deprecated template for code {code}", file=sys.stderr)
        return Deprecated()
