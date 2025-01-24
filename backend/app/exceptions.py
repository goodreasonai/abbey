from .configs.user_config import MAX_PDF_PAGES

class NoCreateError(Exception):
    def __init__(self, message="Object not meant to be created, but creation was necessary."):
        super().__init__(message)

class PdfTooLongError(Exception):
    def __init__(self, message=f"PDF has too many pages. Limit is {MAX_PDF_PAGES}."):
        super().__init__(message)

class RetrieverEmbeddingsError(Exception):
    def __init__(self, message=f"Something went wrong with embeddings (usually because no embeddings were calculated)."):
        super().__init__(message)

class ZipFileRetrieverError(Exception):
    def __init__(self, message="Zip files are not allowed to be retrieved from."):
        super().__init__(message)

class UserIsNoneError(Exception):
    def __init__(self, message="User must not be None for this action."):
        super().__init__(message)

class EmailFailed(Exception):
    def __init__(self, message="", response_text="") -> None:
        full_message = message
        if response_text:
            full_message += f"\nFailed to send email using API.\n\nHere was the response: \"{response_text}\""
        super().__init__(full_message)

class ScraperUnavailable(Exception):
    def __init__(self, message="") -> None:
        true_message = str(message)
        if not true_message:
            true_message = "There is no scraper service configured in settings"
        super().__init__(true_message)

class QueueDuplicate(Exception):
    def __init__(self, message="") -> None:
        true_message = str(message)
        if not true_message:
            true_message = "The item you are adding to the queue is already in the queue"
        super().__init__(true_message)

class QueueFull(Exception):
    def __init__(self, message="") -> None:
        true_message = str(message)
        if not true_message:
            true_message = "The queue is full"
        super().__init__(true_message)
