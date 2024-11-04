import time
from .templates.templates import TEMPLATES
from .templates.template import Template, EmailRules
from .email import send_email, log_notif
from .configs.str_constants import SCHEDULED_ENDPOINT

"""

Designed as the entry point to a separate process that sends emails, like reminders.

Designed to have LOW CONTROL OVER TIMING. Only runs (small) x many times a day.

Do not import anything from here.

"""

MAIN_LOOP_SLEEP = 60 * 5  # in seconds


# This should be the target of a thread in the future, and should probably spawn threads
# TODO

def send_the_emails(emails):
    for email_info in emails:
        recipients = email_info['recipients']  # must have len = n recipients
        subject = email_info['subject']
        email_body = email_info['email_body']
        
        send_email(recipients, subject, email_body)
        log_notif('email',
            len(recipients),
            metadata=email_info,
            endpoint=SCHEDULED_ENDPOINT,
            user_id=email_info['_info']['user_id'],
            asset_id=email_info['_info']['asset_id'],
        )


# Main loop
if __name__ == '__main__':
    print("Email process entering main loop")
    while True:
        """

        In a pass, we call each template's email scheduler function, which will do template specific scheduled notifications.

        """
        for tmp in TEMPLATES:
            tmp: Template
            email_rules: EmailRules = tmp.email_rules
            try:
                emails = email_rules.schedule_emails()
                send_the_emails(emails)
            except Exception as e:
                print(f"Error in template email scheduler: {e}")

        time.sleep(MAIN_LOOP_SLEEP)
