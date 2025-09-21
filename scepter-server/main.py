import os
import logging
import sys
from flask import Flask, send_from_directory, request, jsonify
from flask_socketio import SocketIO, emit, join_room, leave_room, disconnect

from routes.games import create_game_file, list_games, get_player_profile
from routes.planets import (
    list_catalog_planets,
    list_player_planets,
    add_player_planet,
    update_player_planet_state,
    remove_player_planet,
    list_game_planet_definitions
)
from routes.technology import (
    list_catalog_technologies,
    list_player_technologies,
    add_player_technology,
    update_player_technology_state,
    remove_player_technology,
    list_player_technology_definitions
)
from components.planet_catalog import PlanetCatalogError
from components.technology_catalog import TechnologyCatalogError
from components.session_manager import session_manager
from config import get_config

# Get configuration
config = get_config()

# Configure logging
logging.basicConfig(
    level=getattr(logging, config.LOG_LEVEL),
    format=config.LOG_FORMAT
)
logger = logging.getLogger(__name__)

# Initialize Flask app and SocketIO
app = Flask(__name__, static_folder=config.STATIC_FOLDER, static_url_path=config.STATIC_URL_PATH)
socketio = SocketIO(app, cors_allowed_origins="*", logger=False, engineio_logger=False)

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

@app.route('/api/active-games', methods=['GET'])
def get_active_games():
    """API endpoint to get currently active (hosted) games"""
    try:
        active_games = session_manager.get_active_games()
        logger.info(f"Found {len(active_games)} active games")
        return jsonify({"games": active_games}), 200
    except Exception as e:
        logger.error(f"Error getting active games: {e}", exc_info=True)
        return jsonify({"error": "Failed to get active games"}), 500

@app.route('/api/game/<game_name>/players', methods=['GET'])
def get_game_players(game_name):
    """API endpoint to get players for a specific game"""
    try:
        players = session_manager.get_game_players(game_name)
        return jsonify({"players": players}), 200
    except Exception as e:
        logger.error(f"Error getting players for game '{game_name}': {e}", exc_info=True)
        return jsonify({"error": "Failed to get game players"}), 500


@app.route('/api/game/<game_name>/player/<player_id>', methods=['GET'])
def get_player_info(game_name, player_id):
    """API endpoint to get a single player's profile for a specific game."""
    response, status = get_player_profile(game_name, player_id, GAMES_DIR)
    return jsonify(response), status


@app.route('/api/planets/catalog', methods=['GET'])
def get_planet_catalog():
    """Return the base planet catalog."""
    try:
        catalog = list_catalog_planets()
        return jsonify(catalog), 200
    except PlanetCatalogError as e:
        logger.error("Planet catalog error: %s", e)
        return jsonify({"error": "Planet catalog unavailable"}), 500


@app.route('/api/technology/catalog', methods=['GET'])
def get_technology_catalog():
    """Return the base technology catalog."""
    try:
        catalog = list_catalog_technologies()
        return jsonify(catalog), 200
    except TechnologyCatalogError as e:
        logger.error("Technology catalog error: %s", e)
        return jsonify({"error": "Technology catalog unavailable"}), 500


@app.route('/api/game/<game_name>/planets/definitions', methods=['GET'])
def get_game_planet_definitions(game_name):
    """Return the planet definitions stored for a specific game."""
    response, status = list_game_planet_definitions(game_name, GAMES_DIR)
    return jsonify(response), status


@app.route('/api/game/<game_name>/player/<player_id>/planets', methods=['GET'])
def get_player_planets(game_name, player_id):
    """Return the planets currently owned by the player."""
    response, status = list_player_planets(game_name, player_id, GAMES_DIR)
    return jsonify(response), status


@app.route('/api/game/<game_name>/player/<player_id>/planets', methods=['POST'])
def create_player_planet(game_name, player_id):
    """Assign a planet to a player."""
    data = request.get_json(silent=True) or {}
    response, status = add_player_planet(game_name, player_id, data.get('planetKey'), GAMES_DIR)
    return jsonify(response), status


@app.route('/api/game/<game_name>/player/<player_id>/planets/<planet_key>', methods=['PATCH'])
def patch_player_planet(game_name, player_id, planet_key):
    """Update a player's planet state such as exhausted/ready."""
    data = request.get_json(silent=True) or {}
    if 'isExhausted' not in data:
        return jsonify({"error": "isExhausted is required"}), 400

    is_exhausted = bool(data.get('isExhausted'))
    response, status = update_player_planet_state(game_name, player_id, planet_key, is_exhausted, GAMES_DIR)
    return jsonify(response), status


@app.route('/api/game/<game_name>/player/<player_id>/planets/<planet_key>', methods=['DELETE'])
def delete_player_planet(game_name, player_id, planet_key):
    """Remove a planet from a player."""
    response, status = remove_player_planet(game_name, player_id, planet_key, GAMES_DIR)
    return jsonify(response), status


@app.route('/api/game/<game_name>/player/<player_id>/technology', methods=['GET'])
def get_player_technology(game_name, player_id):
    """Return the technology cards currently owned by the player."""
    response, status = list_player_technologies(game_name, player_id, GAMES_DIR)
    return jsonify(response), status


@app.route('/api/game/<game_name>/player/<player_id>/technology', methods=['POST'])
def create_player_technology(game_name, player_id):
    """Assign a technology card to a player."""
    data = request.get_json(silent=True) or {}
    response, status = add_player_technology(game_name, player_id, data.get('technologyKey'), GAMES_DIR)
    return jsonify(response), status


@app.route('/api/game/<game_name>/player/<player_id>/technology/<technology_key>', methods=['PATCH'])
def patch_player_technology(game_name, player_id, technology_key):
    """Update a player's technology state such as exhausted/ready."""
    data = request.get_json(silent=True) or {}
    if 'isExhausted' not in data:
        return jsonify({"error": "isExhausted is required"}), 400

    is_exhausted = bool(data.get('isExhausted'))
    response, status = update_player_technology_state(game_name, player_id, technology_key, is_exhausted, GAMES_DIR)
    return jsonify(response), status


@app.route('/api/game/<game_name>/player/<player_id>/technology/<technology_key>', methods=['DELETE'])
def delete_player_technology(game_name, player_id, technology_key):
    """Remove a technology card from a player."""
    response, status = remove_player_technology(game_name, player_id, technology_key, GAMES_DIR)
    return jsonify(response), status


@app.route('/api/game/<game_name>/player/<player_id>/technology/definitions', methods=['GET'])
def get_player_technology_definitions(game_name, player_id):
    """Return the technology definitions available to the player."""
    response, status = list_player_technology_definitions(game_name, player_id, GAMES_DIR)
    return jsonify(response), status

# WebSocket event handlers
@socketio.on('connect')
def handle_connect():
    """Handle client connection"""
    # Get connection type from query parameters
    connection_type = request.args.get('type', 'unknown')
    logger.info(f"Client connected: {request.sid} (type: {connection_type})")
    emit('connected', {'sessionId': request.sid})

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection"""
    # Get connection type from query parameters 
    connection_type = request.args.get('type', 'unknown')
    logger.info(f"Client disconnected: {request.sid} (type: {connection_type})")
    
    # Check if this session ID exists in any game
    if request.sid in session_manager.session_to_game:
        game_name = session_manager.session_to_game[request.sid]
        session = session_manager.active_sessions.get(game_name)
        
        if session and request.sid == session.host_session_id:
            # This is the actual host session - end the game
            game_name = session_manager.stop_hosting_session(request.sid)
            if game_name:
                logger.info(f"Host disconnected from game '{game_name}' - ending session")
                socketio.emit('session_ended', {
                    'gameName': game_name,
                    'message': 'Host has left the game. Session ended.'
                }, room=game_name)
        else:
            # This is a player session - remove just the player
            removed_info = session_manager.remove_player_from_session(request.sid)
            if removed_info:
                logger.info(f"Player '{removed_info['player_name']}' disconnected from game '{removed_info['game_name']}'")
                # Notify other players in the game that this player left
                socketio.emit('player_left', {
                    'playerName': removed_info['player_name'],
                    'playerId': removed_info['player_id']
                }, room=removed_info['game_name'])

@socketio.on('host_game')
def handle_host_game(data):
    """Handle game hosting request"""
    try:
        game_name = data.get('gameName')
        if not game_name:
            emit('error', {'message': 'Game name is required'})
            return
        
        logger.info(f"Hosting request for game: '{game_name}' from session: {request.sid}")
        
        # Build database path
        safe_game_name = "".join(c for c in game_name if c.isalnum() or c in (' ', '-', '_')).strip()
        db_path = os.path.join(GAMES_DIR, f"{safe_game_name}.sqlite3")
        
        # Start hosting session
        success = session_manager.start_hosting_session(game_name, db_path, request.sid)
        
        if success:
            # Join the host to the game room
            join_room(game_name)
            
            # Get players for this game
            players = session_manager.get_game_players(game_name)
            
            # Notify the host that hosting started
            emit('hosting_started', {
                'gameName': game_name,
                'localIp': session_manager.get_local_ip(),
                'players': players
            })
            
            logger.info(f"Successfully started hosting '{game_name}' with {len(players)} players")
            logger.debug(f"Current active sessions: {list(session_manager.active_sessions.keys())}")
        else:
            emit('error', {'message': f'Failed to start hosting: {game_name}'})
            
    except Exception as e:
        logger.error(f"Error hosting game: {e}", exc_info=True)
        emit('error', {'message': 'Failed to start hosting'})

@socketio.on('join_game')
def handle_join_game(data):
    """Handle player joining game request"""
    try:
        game_name = data.get('gameName')
        player_id = data.get('playerId')
        player_name = data.get('playerName')
        
        logger.info(f"Join request - Game: '{game_name}', Player: '{player_name}', Session: {request.sid}")
        logger.debug(f"Current active sessions: {list(session_manager.active_sessions.keys())}")
        
        if not all([game_name, player_id, player_name]):
            emit('error', {'message': 'Game name, player ID, and player name are required'})
            return
        
        # Join player to session
        success = session_manager.join_player_to_session(game_name, player_id, player_name, request.sid)
        
        if success:
            # Join the player to the game room
            join_room(game_name)
            
            # Notify the player they joined successfully
            emit('joined_game', {
                'gameName': game_name,
                'playerId': player_id,
                'playerName': player_name
            })
            
            # Notify others in the game about the new player
            emit('player_joined', {
                'playerId': player_id,
                'playerName': player_name
            }, room=game_name, include_self=False)
            
            logger.info(f"Player '{player_name}' joined game '{game_name}'")
        else:
            # Check if the game exists but isn't being hosted
            active_games = session_manager.get_active_games()
            active_game_names = [game['name'] for game in active_games]
            
            if game_name not in active_game_names:
                emit('error', {'message': f'Game "{game_name}" is not currently being hosted. Ask the host to start hosting the game first.'})
            else:
                emit('error', {'message': f'Failed to join game "{game_name}". You may already be connected or the session is full.'})
            
    except Exception as e:
        logger.error(f"Error joining game: {e}", exc_info=True)
        emit('error', {'message': 'Failed to join game'})

@socketio.on('leave_game')
def handle_leave_game():
    """Handle player leaving game request"""
    try:
        removed_info = session_manager.remove_player_from_session(request.sid)
        if removed_info:
            # Leave the game room
            leave_room(removed_info['game_name'])
            
            # Notify the player they left
            emit('left_game', {'gameName': removed_info['game_name']})
            
            # Notify others in the game
            emit('player_left', {
                'playerId': removed_info['player_id'],
                'playerName': removed_info['player_name']
            }, room=removed_info['game_name'])
            
            logger.info(f"Player '{removed_info['player_name']}' left game '{removed_info['game_name']}'")
        else:
            emit('error', {'message': 'Not currently in a game'})
            
    except Exception as e:
        logger.error(f"Error leaving game: {e}", exc_info=True)
        emit('error', {'message': 'Failed to leave game'})

@socketio.on('get_session_info')
def handle_get_session_info():
    """Handle request for current session information"""
    try:
        session_info = session_manager.get_session_info(request.sid)
        if session_info:
            emit('session_info', session_info)
        else:
            emit('session_info', {'game_name': None, 'is_host': False, 'player_info': None})
    except Exception as e:
        logger.error(f"Error getting session info: {e}", exc_info=True)
        emit('error', {'message': 'Failed to get session info'})

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
        
        # Start the application with SocketIO
        logger.info("Starting Scepter Server with WebSocket support...")
        socketio.run(app, debug=config.DEBUG, host=config.HOST, port=config.PORT, allow_unsafe_werkzeug=True)
        
    except Exception as e:
        logger.error(f"Failed to start application: {e}", exc_info=True)
        return 1
    
    return 0

if __name__ == '__main__':
    sys.exit(main())
