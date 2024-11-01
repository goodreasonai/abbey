#!/bin/bash

# Define the Python script you want to run
PYTHON_SCRIPT="setup-helpers/run.py"

# Function to check Python installation
check_python() {
    if command -v python3 &>/dev/null; then
        echo "Python 3 is already installed."
        return 0
    else
        echo "Python 3 is not installed."
        return 1
    fi
}

# Function to install Python on Linux
install_python_linux() {
    if command -v apt &>/dev/null; then
        echo "Using apt to install Python 3..."
        sudo apt update
        sudo apt install -y python3
    elif command -v yum &>/dev/null; then
        echo "Using yum to install Python 3..."
        sudo yum install -y python3
    else
        echo "No supported package manager found. Please install Python 3 manually."
        exit 1
    fi
}

# Function to install Python on macOS
install_python_macos() {
    if command -v brew &>/dev/null; then
        echo "Using Homebrew to install Python 3..."
        brew install python3
    else
        echo "Homebrew not found. Please install Homebrew and try again."
        exit 1
    fi
}

# Function to install Python on Windows
install_python_windows() {
    if command -v choco &>/dev/null; then
        echo "Using Chocolatey to install Python 3..."
        choco install python --version=3 -y
    else
        echo "Chocolatey not found. Please install Python 3 manually from https://www.python.org/downloads/windows/"
        exit 1
    fi
}

# Main script logic
if check_python; then
    echo "Proceeding to run the Python script..."
else
    read -p "Do you want to install Python 3? (y/n): " choice
    case "$choice" in
        y|Y )
            if [[ "$OSTYPE" == "linux-gnu"* ]]; then
                install_python_linux
            elif [[ "$OSTYPE" == "darwin"* ]]; then
                install_python_macos
            elif [[ "$OSTYPE" == "msys"* || "$OSTYPE" == "cygwin"* ]]; then
                install_python_windows
            else
                echo "Unsupported OS. Please install Python 3 manually."
                exit 1
            fi
            ;;
        n|N )
            echo "Python 3 will not be installed. Exiting script."
            exit 1
            ;;
        * )
            echo "Invalid input. Exiting script."
            exit 1
            ;;
    esac
fi

# Run the Python script
echo "Running Abbey..."
python3 "$PYTHON_SCRIPT"
