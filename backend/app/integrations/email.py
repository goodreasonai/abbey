from ..configs.user_config import EMAIL_FROM_NAME, EMAIL_FROM_ADDRESS, APP_NAME, SENDGRID_UNSUB_GROUP
from ..configs.secrets import SENDGRID_API_KEY, SMTP_EMAIL, SMTP_PASSWORD, SMTP_PORT, SMTP_SERVER
from ..exceptions import EmailFailed
import requests
import smtplib
from email.message import EmailMessage


class Email():
    def __init__(self, code) -> None:
        self.code = code

    # The HTML that wraps every email
    def _email_wrap(self, children):
        beginning = '<html><body style="width:70%;margin:auto;min-width:500px;padding-top:2rem;line-height:1.5rem;"><p>'
        end = f"</p><p>Best,<br/>{APP_NAME} Email Bot</p></body></html>"
        return "".join([beginning, children, end])
    
    def send_email(self, recipients: list, subject, email_body, from_email=EMAIL_FROM_ADDRESS, from_name=EMAIL_FROM_NAME):  # should probably never change the from email.
        raise Exception(f"Send email not implemented for email service with code {self.code}")


class SMTP(Email):
    def __init__(self) -> None:
        super().__init__(code="smtp")

    def send_email(self, recipients: list, subject, email_body, from_email=EMAIL_FROM_ADDRESS, from_name=EMAIL_FROM_NAME):  # should probably never change the from email.
        messages = []
        for to_email in recipients:
            msg = EmailMessage()
            html = self._email_wrap(email_body)
            msg['Subject'] = subject
            msg['From'] = from_email
            msg['To'] = to_email
            msg.add_alternative(html, subtype='html')
            messages.append(msg)

        # Connect to the SMTP server and send the email
        try:
            with smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT) as server:
                server.login(SMTP_EMAIL, SMTP_PASSWORD)
                for msg in messages:
                    server.send_message(msg)
        except Exception as e:
            raise EmailFailed(f'Sending emails got an error: {e}')


class Sendgrid(Email):
    def __init__(self) -> None:
        self.api_url = "https://api.sendgrid.com/v3/mail/send"
        super().__init__(code="sendgrid")
    
    def send_email(self, recipients: list, subject, email_body, from_email=EMAIL_FROM_ADDRESS, from_name=EMAIL_FROM_NAME):  # should probably never change the from email.
        objectified_emails = list(map(lambda x: {'email': x}, recipients))

        body = self._email_wrap(email_body)

        payload = {
            "personalizations": [{"to": objectified_emails}],
            "from": {"email": from_email, 'name': from_name},
            'subject': subject,
            "content": [{'type': "text/html", "value": body}],
            "asm": {"group_id": SENDGRID_UNSUB_GROUP}  # Add the unsubscribe group ID here
        }

        headers = {
            "Authorization": f"Bearer {SENDGRID_API_KEY}",
            "Content-Type": "application/json"
        }
        
        response = requests.post(self.api_url, json=payload, headers=headers)

        if response.status_code > 299:
            raise EmailFailed(response_text=response.text)


EMAIL_PROVIDERS = {
    'sendgrid': Sendgrid(),
    'smtp': SMTP()
}