import os
import datetime
import uuid
import logging
from typing import List, Dict, Any, Tuple

from components.database import execute_query, execute_script, table_exists, DatabaseError

logger = logging.getLogger(__name__)

def create_game_file(game_name: str, players: List[Dict], games_dir: str = 'games') -> Tuple[Dict[str, Any], int]:
    """
    Create a new game database with the given name and players
    
    Args:
        game_name: Name of the game
        players: List of player dictionaries with 'name' key
        games_dir: Directory to store game files
        
    Returns:
        Tuple of (response_dict, status_code)
    """
    try:
        # Validate inputs
        if not game_name or not game_name.strip():
            return {"error": "Game name cannot be empty"}, 400
            
        if not players or len(players) == 0:
            return {"error": "At least one player is required"}, 400
            
        # Ensure games directory exists
        os.makedirs(games_dir, exist_ok=True)
        
        # Create database path
        safe_game_name = "".join(c for c in game_name if c.isalnum() or c in (' ', '-', '_')).strip()
        db_path = os.path.join(games_dir, f"{safe_game_name}.sqlite3")
        
        # Check if database already exists
        if os.path.exists(db_path):
            return {"error": "Game with this name already exists"}, 400
        
        # Create database schema
        schema_script = '''
            CREATE TABLE players (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                playerId TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                resources INTEGER DEFAULT 0,
                influence INTEGER DEFAULT 0,
                commodities INTEGER DEFAULT 0,
                trade_goods INTEGER DEFAULT 0,
                victoryPoints INTEGER DEFAULT 0,
                faction TEXT
            );
            
            CREATE TABLE game_metadata (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        '''
        
        execute_script(db_path, schema_script)
        
        # Insert game metadata
        current_time = datetime.datetime.now().isoformat()
        execute_query(
            db_path, 
            "INSERT INTO game_metadata (name, created_at, last_updated) VALUES (?, ?, ?)", 
            (game_name, current_time, current_time)
        )
        
        # Insert players
        for player in players:
            player_name = player.get('name', '').strip()
            if not player_name:
                # Clean up the created database if player validation fails
                if os.path.exists(db_path):
                    os.remove(db_path)
                return {"error": "All players must have a name"}, 400
                
            player_id = str(uuid.uuid4())
            execute_query(
                db_path, 
                "INSERT INTO players (playerId, name) VALUES (?, ?)", 
                (player_id, player_name)
            )
        
        logger.info(f"Successfully created game '{game_name}' with {len(players)} players")
        return {"success": True, "database": safe_game_name, "path": db_path}, 200
        
    except DatabaseError as e:
        logger.error(f"Database error creating game '{game_name}': {e}")
        # Clean up partial database if it exists
        if 'db_path' in locals() and os.path.exists(db_path):
            try:
                os.remove(db_path)
            except OSError:
                pass
        return {"error": "Failed to create game database"}, 500
        
    except Exception as e:
        logger.error(f"Unexpected error creating game '{game_name}': {e}")
        return {"error": "An unexpected error occurred"}, 500

def list_games(games_dir: str = 'games') -> Dict[str, Any]:
    """
    List all games in the specified directory
    
    Args:
        games_dir: Directory containing game files
        
    Returns:
        Dictionary containing list of games with metadata
    """
    games = []
    
    try:
        if not os.path.exists(games_dir):
            logger.warning(f"Games directory '{games_dir}' does not exist")
            return {'games': games}
        
        for filename in os.listdir(games_dir):
            if not filename.endswith('.sqlite3'):
                continue
                
            game_name = filename[:-8]  # Remove .sqlite3 extension
            file_path = os.path.join(games_dir, filename)
            
            try:
                # Get file creation time as fallback
                created_time = datetime.datetime.fromtimestamp(os.path.getctime(file_path))
                
                # Try to get metadata from database
                game_metadata = get_game_metadata(file_path)
                
                if game_metadata:
                    games.append({
                        'name': game_metadata.get('name', game_name),
                        'created': game_metadata.get('created_at', created_time.isoformat()),
                        'lastUpdated': game_metadata.get('last_updated', created_time.isoformat()),
                        'playerCount': get_player_count(file_path)
                    })
                else:
                    # Fallback if database is corrupted or doesn't have metadata
                    games.append({
                        'name': game_name,
                        'created': created_time.isoformat(),
                        'lastUpdated': created_time.isoformat(),
                        'playerCount': 0
                    })
                    
            except Exception as e:
                logger.warning(f"Error reading game file '{filename}': {e}")
                # Skip corrupted files but continue processing others
                continue
                
    except Exception as e:
        logger.error(f"Error listing games in directory '{games_dir}': {e}")
        return {'games': [], 'error': 'Failed to list games'}
    
    # Sort games by last updated (most recent first)
    games.sort(key=lambda x: x.get('lastUpdated', ''), reverse=True)
    
    return {'games': games}

def get_game_metadata(db_path: str) -> Dict[str, Any]:
    """
    Get game metadata from database
    
    Args:
        db_path: Path to the game database
        
    Returns:
        Dictionary with game metadata or None if not found
    """
    try:
        if not table_exists(db_path, 'game_metadata'):
            return None
            
        return execute_query(
            db_path, 
            "SELECT name, created_at, last_updated FROM game_metadata WHERE id = 1", 
            fetch_one=True
        )
    except DatabaseError:
        return None

def get_player_count(db_path: str) -> int:
    """
    Get the number of players in a game
    
    Args:
        db_path: Path to the game database
        
    Returns:
        Number of players or 0 if error
    """
    try:
        if not table_exists(db_path, 'players'):
            return 0
            
        result = execute_query(
            db_path, 
            "SELECT COUNT(*) as count FROM players", 
            fetch_one=True
        )
        return result['count'] if result else 0
    except DatabaseError:
        return 0

def update_game_timestamp(db_path: str) -> bool:
    """
    Update the last_updated timestamp for a game
    
    Args:
        db_path: Path to the game database
        
    Returns:
        True if successful, False otherwise
    """
    try:
        current_time = datetime.datetime.now().isoformat()
        execute_query(
            db_path, 
            "UPDATE game_metadata SET last_updated = ? WHERE id = 1", 
            (current_time,)
        )
        return True
    except DatabaseError:
        return False