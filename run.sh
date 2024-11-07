#!/bin/bash

# Constants
SETUP_STATUS_FILE="setup-helpers/setup_status.txt"
SETUP_STATUS_COMPLETE="COMPLETE"
TRUE_VALUE="yes"  # true/false global variables are set using this.
FALSE_VALUE="no"
BACKEND_ENV_FILE="backend/app/configs/.env"
FRONTEND_ENV_FILE="frontend/.env.local"

# Globals (TBD by user)
FRONTEND_URL=""
BACKEND_URL=""

USING_EMAIL=""

SEND_EMAILS=""
SMTP_SERVER=""
SMTP_PORT=""
SMTP_USERNAME=""
SMTP_PASSWORD=""

MYSQL_ROOT_PASSWORD=""

USE_OPENAI=""
OPENAI_KEY=""

USE_ANTHROPIC=""
ANTHROPIC_KEY=""

USE_MATHPIX=""
MATHPIX_APP=""
MATHPIX_KEY=""

USE_ELEVEN_LABS=""
ELEVEN_LABS_KEY=""

USE_WEB=""
BING_KEY=""

USE_GOOGLE_AUTH=""
GOOGLE_AUTH_CLIENT_ID=""
GOOGLE_AUTH_CLIENT_SECRET=""

USE_GITHUB_AUTH=""
GITHUB_AUTH_CLIENT_ID=""
GITHUB_AUTH_CLIENT_SECRET=""

USE_KEYCLOAK_AUTH=""
KEYCLOAK_CLIENT_SECRET=""
KEYCLOAK_CLIENT_ID=""
KEYCLOAK_REALM=""
KEYCLOAK_HOST=""

JWT_SECRET=""
REFRESH_SECRET=""

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
    configure_url
    configure_email
    configure_db
    configure_ai
    configure_search_engine
    configure_auth

    export_backend_env
    export_frontend_env
    export_root_env

    # record_setup_complete
    # return 0  # Return 0 to indicate success
    return 1
}

# Function to ask a yes/no question
ask_yes_no() {
    local prompt="$1"
    local response
    while true; do
        read -rp "$prompt (y/n):`echo $'\n> '`" response
        case "$response" in
            [Yy]*) return 0 ;;
            [Nn]*) return 1 ;;
            *) echo "Please answer yes or no." ;;
        esac
    done
}

# Function to ask for a credential
ask_credential() {
    local prompt="$1"
    local response
    read -rp "$prompt:`echo $'\n> '`" response
    echo "$response"
}

generate_password() {
    local length=15
    local charset="A-Za-z0-9"
    local password=$(LC_ALL=C tr -dc "$charset" < /dev/urandom | head -c $length)
    echo $password
}

configure_url() {
    echo "When Abbey runs altogether on your machine inside docker containers, those containers expose port 3000 for the frontend, and port 5000 for the backend, by default."
    FRONTEND_URL=$(ask_credential "What public-facing URL will your machine use for the frontend? Ex: https://my-frontend.com or http://localhost:3000 if just used locally.")
    BACKEND_URL=$(ask_credential "What public-facing URL will your machine use for the backend? Ex: https://my-backend.com or http://localhost:5000 if just used locally.")
}

configure_email() {
    if ask_yes_no "Do you want to let Abbey send emails? You'll need an SMTP server (email)."; then
        SEND_EMAILS=$TRUE_VALUE
        echo "OK, please provide your email credentials for SMTP"
        
        SMTP_SERVER=$(ask_credential "SMTP Server")
        SMTP_PORT=$(ask_credential "SMTP Port")
        SMTP_USERNAME=$(ask_credential "SMTP Username (email)")
        SMTP_PASSWORD=$(ask_credential "SMTP Password")
    else
        SEND_EMAILS=$FALSE_VALUE
    fi
}

configure_db() {    
    # Make MySQL root password
    MYSQL_ROOT_PASSWORD=$(generate_password)
}

configure_auth() {
    # What auth providers would you like to use?
    # What are your client ids / client secrets
    
    echo "Abbey relies on 3rd party OAuth2 authentication providers, like Google. You need to have a client ID and client secret for each OAuth provider you wish to configure."
    echo "Abbey supports Google, GitHub, and Keycloak. If you'd like more, please contribute on GitHub!"
    
    if ask_yes_no "Would you like to configure Google OAuth2?"; then
        USE_GOOGLE_AUTH=$TRUE_VALUE
        GOOGLE_AUTH_CLIENT_ID=$(ask_credential "Please provide a Google client ID")
        GOOGLE_AUTH_CLIENT_SECRET=$(ask_credential "Please provide a Google client secret")
    else
        USE_GOOGLE_AUTH=$FALSE_VALUE
    fi

    if ask_yes_no "Would you like to configure GitHub OAuth2?"; then
        USE_GITHUB_AUTH=$TRUE_VALUE
        GITHUB_AUTH_CLIENT_ID=$(ask_credential "Please provide a GitHub client ID")
        GITHUB_AUTH_CLIENT_SECRET=$(ask_credential "Please provide a GitHub client secret")
    else
        USE_GITHUB_AUTH=$FALSE_VALUE
    fi

    if ask_yes_no "Would you like to configure KeyCloak OAuth2?"; then
        USE_KEYCLOAK_AUTH=$TRUE_VALUE
        KEYCLOAK_CLIENT_ID=$(ask_credential "Please provide a Keycloak client ID")
        KEYCLOAK_REALM=$(ask_credential "Please provide a Keycloak realm")
        KEYCLOAK_CLIENT_SECRET=$(ask_credential "Please provide a Keycloak client secret")
        KEYCLOAK_HOST=$(ask_credential "Please provide a Keycloak host (like https://my-keycloak.com)")
    else
        USE_KEYCLOAK_AUTH=$FALSE_VALUE
    fi

    JWT_SECRET=$(generate_password)
    REFRESH_SECRET=$(generate_password)
}

configure_ai() {
    # What ai providers would you like to use?
    # What are your keys?
    echo "To use Abbey, you will need to configure some AI providers, like the OpenAI API. Otherwise, you can implement your own API in the integrations folder in the backend."
    if ask_yes_no "Would you like to configure the OpenAI API?"; then
        USE_OPENAI=$TRUE_VALUE
        OPENAI_KEY=$(ask_credential "OK, please provide an OpenAI API key")
    else
        USE_OPENAI=$FALSE_VALUE
    fi

    if ask_yes_no "Would you like to configure the Anthropic API?"; then
        USE_ANTHROPIC=$TRUE_VALUE
        ANTHROPIC_KEY=$(ask_credential "OK, please provide an Anthropic API key")
    else
        USE_ANTHROPIC=$FALSE_VALUE
    fi

    if ask_yes_no "Would you like to configure the Mathpix API for OCR?"; then
        USE_MATHPIX=$TRUE_VALUE
        MATHPIX_APP=$(ask_credential "OK, please provide a Mathpix App Name")
        MATHPIX_KEY=$(ask_credential "OK, please provide a Mathpix API key")
    else
        USE_MATHPIX=$FALSE_VALUE
    fi

    if ask_yes_no "Would you like to configure the Eleven Labs for text-to-speech?"; then
        USE_ELEVEN_LABS=$TRUE_VALUE
        ELEVEN_LABS_KEY=$(ask_credential "OK, please provide an Eleven Labs API key")
    else
        USE_ELEVEN_LABS=$FALSE_VALUE
    fi

    echo "AI configuration completed."
}

configure_search_engine() {
    # Would you like to use bing?
    # What is your bing API key?
    if ask_yes_no "Would you like to use the Bing API to allow Abbey to search the web?"; then
        USE_WEB=$TRUE_VALUE
        BING_KEY=$(ask_credential "OK, please provide a Bing API key")
    else
        USE_WEB=$FALSE_VALUE
    fi
}

export_backend_env() {
    # Create or overwrite the .env file
    {
        if [ "$SEND_EMAILS" = "$TRUE_VALUE" ]; then
            echo "SMTP_SERVER=\"$SMTP_SERVER\""
            echo "SMTP_PORT=\"$SMTP_PORT\""
            echo "SMTP_EMAIL=\"$SMTP_USERNAME\""
            echo "SMTP_PASSWORD=\"$SMTP_PASSWORD\""
        fi

        if [ "$USE_OPENAI" = "$TRUE_VALUE" ]; then
            echo "OPENAI_API_KEY=\"$OPENAI_KEY\""
        fi

        if [ "$USE_ANTHROPIC" = "$TRUE_VALUE" ]; then
            echo "ANTHROPIC_API_KEY=\"$ANTHROPIC_KEY\""
        fi

        if [ "$USE_MATHPIX" = "$TRUE_VALUE" ]; then
            echo "MATHPIX_API_APP=\"$MATHPIX_APP\""
            echo "MATHPIX_API_KEY=\"$MATHPIX_KEY\""
        fi

        if [ "$USE_ELEVEN_LABS" = "$TRUE_VALUE" ]; then
            echo "ELEVEN_LABS_API_KEY=\"$ELEVEN_LABS_KEY\""
        fi

        if [ "$USE_WEB" = "$TRUE_VALUE" ]; then
            echo "BING_API_KEY=\"$BING_KEY\""
        fi

        echo "DB_ENDPOINT=mysql"  # Hard coded into the docker compose
        echo "DB_USERNAME=root"  # Perhaps not good practice?
        echo "DB_PASSWORD=\"$MYSQL_ROOT_PASSWORD\""
        echo "DB_PORT=3306"
        echo "DB_NAME=learn"
        echo "DB_TYPE=local"

        echo "CUSTOM_AUTH_DB_ENDPOINT=mysql"  # Hard coded into the docker compose
        echo "CUSTOM_AUTH_DB_USERNAME=root"  # Perhaps not good practice?
        echo "CUSTOM_AUTH_DB_PASSWORD=\"$MYSQL_ROOT_PASSWORD\""
        echo "CUSTOM_AUTH_DB_PORT=3306"
        echo "CUSTOM_AUTH_DB_NAME=custom_auth"

        echo "SECRET_KEY=$(generate_password)"
        echo "CUSTOM_AUTH_SECRET=\"$JWT_SECRET\""
    } > "$BACKEND_ENV_FILE"
}

export_frontend_env() {
    {
        if [ "$USE_GOOGLE_AUTH" = "$TRUE_VALUE" ]; then
            echo "NEXT_PUBLIC_ENABLE_GOOGLE_AUTH=1"
            echo "GOOGLE_CLIENT_ID=\"$GOOGLE_AUTH_CLIENT_ID\""
            echo "GOOGLE_SECRET=\"$GOOGLE_AUTH_CLIENT_SECRET\""
        fi

        if [ "$USE_GITHUB_AUTH" = "$TRUE_VALUE" ]; then
            echo "NEXT_PUBLIC_ENABLE_GITHUB_AUTH=1"
            echo "GITHUB_CLIENT_ID=\"$GITHUB_AUTH_CLIENT_ID\""
            echo "GITHUB_SECRET=\"$GITHUB_AUTH_CLIENT_SECRET\""
        fi

        if [ "$USE_KEYCLOAK_AUTH" = "$TRUE_VALUE" ]; then
            echo "NEXT_PUBLIC_ENABLE_KEYCLOAK_AUTH=1"
            echo "KEYCLOAK_CLIENT_ID=\"$KEYCLOAK_CLIENT_ID\""
            echo "KEYCLOAK_REALM=\"$KEYCLOAK_REALM\""
            echo "KEYCLOAK_SECRET=\"$KEYCLOAK_CLIENT_SECRET\""
            echo "KEYCLOAK_PUBLIC_URL=\"$KEYCLOAK_HOST\""
        fi

        echo "CUSTOM_AUTH_DB_HOST=mysql"  # Hard coded into the docker compose
        echo "CUSTOM_AUTH_DB_USER=root"  # Perhaps not good practice?
        echo "CUSTOM_AUTH_DB_PASSWORD=\"$MYSQL_ROOT_PASSWORD\""
        echo "CUSTOM_AUTH_DB_PORT=3306"
        echo "CUSTOM_AUTH_DB_NAME=custom_auth"

        echo "NEXT_PUBLIC_BACKEND_URL=\"$BACKEND_URL\""
        echo "NEXT_PUBLIC_ROOT_URL=\"$FRONTEND_URL\""

        echo "NEXT_PUBLIC_AUTH_SYSTEM=custom"  # all self-hosters use custom auth
        echo "NEXT_SERVER_SIDE_BACKEND_URL=http://backend:5000"  # hardcoded into the docker compose

        echo "JWT_SECRET=$JWT_SECRET"
        echo "REFRESH_TOKEN_SECRET=$REFRESH_SECRET"

        echo "JWT_SECRET=$JWT_SECRET"
        echo "REFRESH_TOKEN_SECRET=$REFRESH_SECRET"

        if [ "$USE_MATHPIX" = "$FALSE_VALUE" ]; then
            echo "NEXT_PUBLIC_DISABLE_OCR=1"
        fi

        if [ "$USE_WEB" = "$FALSE_VALUE" ]; then
            echo "NEXT_PUBLIC_DISABLE_WEB=1"
        fi

        # While clerk is available in the config, there needs to be non blank (even if non functional) keys.
        echo "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=not-a-key"
        echo "CLERK_SECRET_KEY=not-a-key"
        
        echo "CUSTOM_AUTH_DATABASE_ENABLED=1"
        echo "NEXT_PUBLIC_HIDE_COLLECTIONS=1"

    } > "$FRONTEND_ENV_FILE"
}

export_root_env() {
    {
        echo "MYSQL_ROOT_PASSWORD=\"$MYSQL_ROOT_PASSWORD\""
    } > .env
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
