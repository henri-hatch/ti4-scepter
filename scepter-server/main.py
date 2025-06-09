import os
import logging
import sys
from flask import Flask, send_from_directory, request, jsonify

from routes.games import create_game_file, list_games
from config import get_config

# Get configuration
config = get_config()

# Configure logging
logging.basicConfig(
    level=getattr(logging, config.LOG_LEVEL),
    format=config.LOG_FORMAT
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__, static_folder=config.STATIC_FOLDER, static_url_path=config.STATIC_URL_PATH)

# Configuration
GAMES_DIR = config.GAMES_DIR
MAX_GAME_NAME_LENGTH = config.MAX_GAME_NAME_LENGTH
MAX_PLAYERS = config.MAX_PLAYERS

def ensure_games_directory():
    """Ensure the games directory exists"""
    if not os.path.exists(GAMES_DIR):
        os.makedirs(GAMES_DIR)
        logger.info(f"Created games directory: {GAMES_DIR}")

def validate_create_game_request(data):
    """
    Validate the create game request data
    
    Returns:
        tuple: (is_valid, error_message)
    """
    if not data:
        return False, "No data provided"
    
    if 'gameName' not in data:
        return False, "Missing required field: gameName"
    
    if 'players' not in data:
        return False, "Missing required field: players"
    
    game_name = data['gameName']
    players = data['players']
    
    # Validate game name
    if not game_name or not game_name.strip():
        return False, "Game name cannot be empty"
    
    if len(game_name.strip()) > MAX_GAME_NAME_LENGTH:
        return False, f"Game name too long (max {MAX_GAME_NAME_LENGTH} characters)"
    
    # Validate players
    if not isinstance(players, list):
        return False, "Players must be a list"
    
    if len(players) < 1:
        return False, "At least one player is required"
    
    if len(players) > MAX_PLAYERS:
        return False, f"Too many players (max {MAX_PLAYERS})"
    
    # Validate individual players
    player_names = set()
    for i, player in enumerate(players):
        if not isinstance(player, dict):
            return False, f"Player {i+1} must be an object"
        
        if 'name' not in player:
            return False, f"Player {i+1} missing required field: name"
        
        player_name = player['name'].strip() if player['name'] else ""
        if not player_name:
            return False, f"Player {i+1} name cannot be empty"
        
        if player_name in player_names:
            return False, f"Duplicate player name: {player_name}"
        
        player_names.add(player_name)
    
    return True, None

@app.route('/api/create-game', methods=['POST'])
def create_game():
    """API endpoint to create a new game"""
    try:
        data = request.get_json()
        
        # Validate request data
        is_valid, error_message = validate_create_game_request(data)
        if not is_valid:
            logger.warning(f"Invalid create game request: {error_message}")
            return jsonify({"error": error_message}), 400
        
        game_name = data['gameName'].strip()
        players = data['players']
        
        # Normalize player data
        normalized_players = []
        for player in players:
            normalized_players.append({
                'name': player['name'].strip()
            })
        
        logger.info(f"Creating game '{game_name}' with {len(normalized_players)} players")
        
        # Create the game
        result, status_code = create_game_file(game_name, normalized_players, GAMES_DIR)
        
        if status_code == 200:
            logger.info(f"Successfully created game '{game_name}'")
        else:
            logger.warning(f"Failed to create game '{game_name}': {result}")
        
        return jsonify(result), status_code
        
    except Exception as e:
        logger.error(f"Unexpected error in create_game: {e}", exc_info=True)
        return jsonify({"error": "An unexpected error occurred"}), 500

@app.route('/api/list-games', methods=['GET'])
def list_all_games():
    """API endpoint to list existing games"""
    try:
        logger.debug("Listing all games")
        games = list_games(GAMES_DIR)
        
        if 'error' in games:
            logger.error(f"Error listing games: {games['error']}")
            return jsonify(games), 500
        
        logger.info(f"Found {len(games['games'])} games")
        return jsonify(games), 200
        
    except Exception as e:
        logger.error(f"Unexpected error in list_all_games: {e}", exc_info=True)
        return jsonify({"error": "Failed to list games"}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "games_directory": GAMES_DIR,
        "games_directory_exists": os.path.exists(GAMES_DIR)
    }), 200

@app.route('/')
def home():
    """Serve the main application"""
    try:
        return send_from_directory(app.static_folder, 'index.html')
    except Exception as e:
        logger.error(f"Error serving home page: {e}")
        return "Application not found", 404

@app.route('/<path:path>')
def catch_all(path):
    """Catch-all route for React Router"""
    try:
        # Try to serve the requested file first
        return send_from_directory(app.static_folder, path)
    except:
        # If file doesn't exist, serve index.html for client-side routing
        try:
            return send_from_directory(app.static_folder, 'index.html')
        except Exception as e:
            logger.error(f"Error serving catch-all route for path '{path}': {e}")
            return "Application not found", 404

@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors"""
    logger.warning(f"Attempt to access non-existent resource: {error}")
    return jsonify({"error": f"Resource not found"}), 404

@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors"""
    logger.error(f"Internal server error: {error}")
    return jsonify({"error": "Internal server error"}), 500

def main():
    """Main application entry point"""
    try:
        # Ensure required directories exist
        ensure_games_directory()
          # Start the application
        logger.info("Starting Scepter Server...")
        app.run(debug=config.DEBUG, host=config.HOST, port=config.PORT)
        
    except Exception as e:
        logger.error(f"Failed to start application: {e}", exc_info=True)
        return 1
    
    return 0

if __name__ == '__main__':
    sys.exit(main())
