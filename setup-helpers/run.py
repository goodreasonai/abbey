import os
from setup import start_setup

SETUP_STATUS_COMPLETE = "COMPLETE"

if __name__ == '__main__':
    # Check if setup is complete
    txt = ""
    try:
        with open('setup_status.txt', 'r') as fhand:
            txt = fhand.read()
    except FileNotFoundError:
        pass

    def run_abbey():
        # Run "docker-compose up"
        try:
            os.execvp('docker-compose', ['docker-compose', 'up'])
        except OSError as e:
            print(f"An error occurred while trying to run docker-compose: {e}")
    
    if txt.strip() == SETUP_STATUS_COMPLETE:
        run_abbey()
    else:
        # Otherwise, run start setup; if it's cool, run abbey.
        should_run = start_setup()
        if should_run:
            run_abbey()

