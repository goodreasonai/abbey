#!/bin/bash

# Constants
SETUP_STATUS_FILE="setup-helpers/setup_status.txt"
SETUP_STATUS_COMPLETE="COMPLETE"

# Globals (TBD by user)
USING_EMAIL=false

run() {
    echo "RUN"
    if [ "$USING_EMAIL" = "true" ]; then
        docker-compose up --profiles email
    else
        docker-compose up
    fi
}

check_if_set_up() {
    if [[ -f $SETUP_STATUS_FILE ]]; then
        if grep -q "$SETUP_STATUS_COMPLETE" "$SETUP_STATUS_FILE"; then
            return 0  # True, setup is complete
        fi
    fi
    return 1  # False, setup is not complete
}

record_setup_complete(){
    echo "$SETUP_STATUS_COMPLETE" > "$SETUP_STATUS_FILE"
}

do_setup() {
    configure_email
    configure_db
    configure_auth
    configure_ai
    configure_search_engine

    record_setup_complete
    return 0  # Return 0 to indicate success
}

configure_email() {
    # Do you want to let Abbey send emails? y/n
    # OK, so what are your email credentials
    echo "EMAIL"
}

configure_db() {
    # What should be the root password for your MySQL server?
    echo "DB"
}

configure_auth() {
    # What auth providers would you like to use?
    # What are your client ids / client secrets
    echo "AUTH"
}

configure_ai() {
    # What ai providers would you like to use?
    # What are your keys?
    echo "AI"
}

configure_search_engine() {
    # Would you like to use bing?
    # What is your bing API key?
    echo "SEARCH ENGINE"
}


# Check if docker-compose is available
if command -v docker-compose >/dev/null 2>&1; then  # If the docker compose command exists
    do_run=false
    if ! check_if_set_up; then
        if do_setup; then
            do_run=true
        fi
    else
        do_run=true
    fi

    if $do_run; then
        run
    fi
else
    echo "docker-compose is not available."
    echo "Please download and install Docker"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "Visit: https://docs.docker.com/desktop/install/mac-install/"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "Visit: https://docs.docker.com/engine/install/"
    elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
        echo "Visit: https://docs.docker.com/desktop/install/windows-install/"
    else
        echo "Please check the Docker website for installation instructions."
    fi
fi
