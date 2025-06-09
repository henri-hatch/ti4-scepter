# Configuration file for Scepter Server
import os

class Config:
    """Base configuration class"""
    # Flask settings
    DEBUG = True
    HOST = '0.0.0.0'
    PORT = 5000
    
    # Application settings
    GAMES_DIR = 'games'
    MAX_GAME_NAME_LENGTH = 100
    MAX_PLAYERS = 20
    
    # Static files
    STATIC_FOLDER = '../scepter-client/dist'
    STATIC_URL_PATH = '/'
    
    # Logging
    LOG_LEVEL = 'INFO'
    LOG_FORMAT = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'

class DevelopmentConfig(Config):
    """Development configuration"""
    DEBUG = True

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
