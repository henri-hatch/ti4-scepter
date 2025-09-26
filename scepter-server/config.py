# Configuration file for Scepter Server
import os
from typing import Optional

from runtime_paths import games_dir, static_assets_dir


_RESOLVED_STATIC_DIR = static_assets_dir()
_RESOLVED_GAMES_DIR = games_dir()


def _static_url_path() -> Optional[str]:
    if not _RESOLVED_STATIC_DIR:
        return None
    return '/'

class Config:
    """Base configuration class"""
    # Flask settings
    DEBUG = True
    HOST = '0.0.0.0'
    PORT = 5000
    
    # Application settings
    GAMES_DIR = str(_RESOLVED_GAMES_DIR)
    MAX_GAME_NAME_LENGTH = 100
    MAX_PLAYERS = 20
    
    # Static files
    STATIC_FOLDER = str(_RESOLVED_STATIC_DIR) if _RESOLVED_STATIC_DIR else None
    STATIC_URL_PATH = _static_url_path()
    
    # Logging
    LOG_LEVEL = 'INFO'
    LOG_FORMAT = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'

class DevelopmentConfig(Config):
    """Development configuration"""
    DEBUG = True
    STATIC_FOLDER = None
    STATIC_URL_PATH = None

class ProductionConfig(Config):
    """Production configuration"""
    DEBUG = False
    LOG_LEVEL = 'WARNING'

# Environment-based configuration selection
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}

def get_config():
    """Get configuration based on environment"""
    env = os.environ.get('FLASK_ENV', 'development')
    return config.get(env, config['default'])
