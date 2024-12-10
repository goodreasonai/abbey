import yaml

CONFIG_PATH = '/etc/abbey/settings.yml'

def get_settings():
    with open(CONFIG_PATH, 'r') as file:
        config = yaml.safe_load(file)
        return config

SETTINGS = get_settings()
