from ..configs.user_config import APP_NAME
from ..configs.secrets import SENDGRID_API_KEY, SMTP_EMAIL, SMTP_PASSWORD, SMTP_PORT, SMTP_SERVER
from ..configs.settings import SETTINGS
from ..exceptions import EmailFailed
import requests
import smtplib
from email.message import EmailMessage
import sys


class Email():
    def __init__(self, code, from_email, from_name) -> None:
        self.code = code
        self.from_email = from_email
        self.from_name = from_name

    # The HTML that wraps every email
    def _email_wrap(self, children):
        beginning = '<html><body style="width:70%;margin:auto;min-width:500px;padding-top:2rem;line-height:1.5rem;"><p>'
        end = f"</p><p>Best,<br/>{APP_NAME} Email Bot</p></body></html>"
        return "".join([beginning, children, end])
    
    def send_email(self, recipients: list, subject, email_body):
        raise Exception(f"Send email not implemented for email service with code {self.code}")


class SMTP(Email):

    def send_email(self, recipients: list, subject, email_body):
        messages = []
        for to_email in recipients:
            msg = EmailMessage()
            html = self._email_wrap(email_body)
            msg['Subject'] = subject
            msg['From'] = self.from_email
            msg['To'] = to_email
            msg.add_alternative(html, subtype='html')
            messages.append(msg)

        server = None
        try:
            server = smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT)            
            server.connect(SMTP_SERVER, SMTP_PORT)            
            server.login(SMTP_EMAIL, SMTP_PASSWORD)
            
            for msg in messages:
                try:
                    server.send_message(msg)
                except Exception as e:
                    to = msg['To']
                    print(f"Error sending message to {to}: {e}")

        except smtplib.SMTPException as e:
            raise EmailFailed(f'SMTP error occurred: {e}')
        except ConnectionError as e:
            raise EmailFailed(f'Connection error occurred: {e}')
        except Exception as e:
            raise EmailFailed(f'Unexpected error occurred: {e}')
        finally:
            # Close the connection in the finally block to ensure it always happens
            if server:
                try:
                    server.quit()
                except Exception as e:
                    print(f"Error closing SMTP connection: {e}")


class Sendgrid(Email):
    def __init__(self, code, from_email, from_name, unsub_group=None) -> None:
        self.unsub_group = unsub_group
        super().__init__(code=code, from_email=from_email, from_name=from_name)
    
    def send_email(self, recipients: list, subject, email_body):
        api_url = "https://api.sendgrid.com/v3/mail/send"

        objectified_emails = list(map(lambda x: {'email': x}, recipients))

        body = self._email_wrap(email_body)

        payload = {
            "personalizations": [{"to": objectified_emails}],
            "from": {"email": self.from_email, 'name': self.from_name},
            'subject': subject,
            "content": [{'type': "text/html", "value": body}],
        }

        if self.unsub_group:
            payload["asm"] = {"group_id": self.unsub_group}

        headers = {
            "Authorization": f"Bearer {SENDGRID_API_KEY}",
            "Content-Type": "application/json"
        }
        
        response = requests.post(api_url, json=payload, headers=headers)

        if response.status_code > 299:
            raise EmailFailed(response_text=response.text)


PROVIDER_TO_EMAIL = {
    'sendgrid': Sendgrid,
    'smtp': SMTP,
}

def make_code_from_setting(email):
    return email['code'] if 'code' in email else email['provider']

"""
Settings look like:

email:
  services:
    - provider: sendgrid  # required
      email: abbey@goodreason.ai  # required
      name: Abbey  # optional, defaults to APP_NAME
      unsub_group: 1234  # optional (only works for Sendgrid)

"""
def generate_email():
    if 'email' not in SETTINGS:
        return {}
    if 'services' not in SETTINGS['email'] or not len(SETTINGS['email']['services']):
        return {}
    
    to_return = {}
    options = SETTINGS['email']['services']
    for option in options:
        if 'disabled' in option and option['disabled']:
            continue
        provider = option['provider']
        provider_class = PROVIDER_TO_EMAIL[provider]
        from_email = option['email']
        from_name = option['name'] if 'name' in option else APP_NAME
        code = make_code_from_setting(option)
        # If adding any other keys, add to the below list so they don't get caught up in kwargs
        KEYS_TO_REMOVE = ['code', 'provider', 'email', 'name']
        kwargs = {key: value for key, value in option.items() if key not in KEYS_TO_REMOVE}  # This is used for extra options for certain providers (like unsub group for Sendgrid)
        obj = provider_class(
            code=code,
            from_name=from_name,
            from_email=from_email,
            **kwargs
        )
        to_return[code] = obj
    return to_return


EMAIL_PROVIDERS = generate_email()


def generate_default():
    if 'email' not in SETTINGS:
        return ""
    if 'services' not in SETTINGS['email'] or not len(SETTINGS['email']['services']):
        return ""
    
    services = SETTINGS['email']['services']

    if 'default' in SETTINGS['email']:
        default =  SETTINGS['email']['default']
        if default not in EMAIL_PROVIDERS:
            print(f"\n\nWARNING: a default you specified, '{default}', does not exist. Make sure you're using the correct code schema as specified in the README. Instead, '{services[0]}' will be used as the default.\n\n", file=sys.stderr)
        else:
            return default
    
    return make_code_from_setting(services[0])  # first available 


DEFAULT_EMAIL_SERVICE = generate_default()
