import os
import datetime
import uuid
import logging
from typing import List, Dict, Any, Tuple, Optional

from components.database import (
    execute_query,
    execute_script,
    table_exists,
    DatabaseError,
    get_db_connection
)
from components.planet_catalog import populate_planet_definitions
from components.technology_catalog import populate_technology_definitions
from components.faction_catalog import get_faction_definition, FactionCatalogError

logger = logging.getLogger(__name__)


def _normalise_faction_key(raw_value: Any) -> Optional[str]:
    """Normalise a raw faction identifier to the canonical storage value."""
    if raw_value is None:
        return None

    value = str(raw_value).strip()
    if not value:
        return None

    if value.lower() == 'none':
        return None

    return value.lower()


def _sync_player_faction_assets(
    db_path: str,
    player_id: str,
    new_faction_key: Optional[str],
    previous_faction_key: Optional[str]
) -> Dict[str, List[str]]:
    """Ensure the player's starting planets and technology match their faction."""
    populate_planet_definitions(db_path)
    populate_technology_definitions(db_path)

    removed_tech: List[str] = []
    removed_planets: List[str] = []
    added_tech: List[str] = []
    added_planets: List[str] = []

    try:
        previous_faction = get_faction_definition(previous_faction_key) if previous_faction_key else None
        new_faction = get_faction_definition(new_faction_key) if new_faction_key else None
    except FactionCatalogError as exc:
        logger.error("Failed to access faction catalog while syncing assets: %s", exc)
        raise

    tech_to_remove = previous_faction.get('startingTech', []) if previous_faction else []
    planets_to_remove = previous_faction.get('homePlanet', []) if previous_faction else []
    tech_to_add = new_faction.get('startingTech', []) if new_faction else []
    planets_to_add = new_faction.get('homePlanet', []) if new_faction else []

    try:
        with get_db_connection(db_path) as connection:
            cursor = connection.cursor()

            if tech_to_remove:
                cursor.executemany(
                    "DELETE FROM playerTechnologies WHERE playerId = ? AND technologyKey = ?",
                    [(player_id, key) for key in tech_to_remove]
                )
                removed_tech = list(tech_to_remove)

            if planets_to_remove:
                cursor.executemany(
                    "DELETE FROM playerPlanets WHERE playerId = ? AND planetKey = ?",
                    [(player_id, key) for key in planets_to_remove]
                )
                removed_planets = list(planets_to_remove)

            if tech_to_add:
                cursor.executemany(
                    "INSERT OR IGNORE INTO playerTechnologies (playerId, technologyKey) VALUES (?, ?)",
                    [(player_id, key) for key in tech_to_add]
                )
                added_tech = list(tech_to_add)

            if planets_to_add:
                cursor.executemany(
                    "INSERT OR IGNORE INTO playerPlanets (playerId, planetKey) VALUES (?, ?)",
                    [(player_id, key) for key in planets_to_add]
                )
                added_planets = list(planets_to_add)

            connection.commit()
    except DatabaseError as exc:
        logger.error(
            "Failed to synchronise faction assets for player '%s' in '%s': %s",
            player_id,
            db_path,
            exc
        )
        raise

    return {
        'technologyAdded': added_tech,
        'technologyRemoved': removed_tech,
        'planetsAdded': added_planets,
        'planetsRemoved': removed_planets
    }

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

        # Seed planet and technology definitions for this game
        populate_planet_definitions(db_path)
        populate_technology_definitions(db_path)

        # Insert game metadata
        current_time = datetime.datetime.now().isoformat()
        execute_query(
            db_path, 
            "INSERT INTO game_metadata (name, created_at, last_updated) VALUES (?, ?, ?)", 
            (game_name, current_time, current_time)
        )
        
        # Insert players
        persisted_players: List[Dict[str, Optional[str]]] = []
        for player in players:
            player_name = player.get('name', '').strip()
            if not player_name:
                # Clean up the created database if player validation fails
                if os.path.exists(db_path):
                    os.remove(db_path)
                return {"error": "All players must have a name"}, 400

            faction_key_raw = player.get('factionKey') if isinstance(player, dict) else None
            if not faction_key_raw:
                faction_key_raw = player.get('faction') if isinstance(player, dict) else None
            faction_key = _normalise_faction_key(faction_key_raw)

            if faction_key:
                try:
                    faction_definition = get_faction_definition(faction_key)
                except FactionCatalogError as exc:
                    logger.error("Failed to load faction catalog during game creation: %s", exc)
                    if os.path.exists(db_path):
                        os.remove(db_path)
                    return {"error": "Unable to validate faction selection"}, 500

                if not faction_definition:
                    if os.path.exists(db_path):
                        os.remove(db_path)
                    return {"error": f"Unknown faction '{faction_key_raw}' for player '{player_name}'"}, 400

            player_id = str(uuid.uuid4())
            execute_query(
                db_path,
                "INSERT INTO players (playerId, name, faction) VALUES (?, ?, ?)",
                (player_id, player_name, faction_key)
            )
            persisted_players.append({
                'playerId': player_id,
                'name': player_name,
                'faction': faction_key
            })

        # Apply starting assets for players with a faction selection
        for persisted in persisted_players:
            faction_key = persisted.get('faction')
            if not faction_key:
                continue

            try:
                _sync_player_faction_assets(db_path, persisted['playerId'], faction_key, None)
            except (DatabaseError, FactionCatalogError):
                if os.path.exists(db_path):
                    os.remove(db_path)
                return {"error": "Failed to assign starting assets"}, 500
        
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


def get_game_db_path(game_name: str, games_dir: str = 'games') -> str:
    """Return the expected database path for a game name."""
    safe_game_name = "".join(c for c in game_name if c.isalnum() or c in (' ', '-', '_')).strip()
    return os.path.join(games_dir, f"{safe_game_name}.sqlite3")


def get_player_profile(game_name: str, player_id: str, games_dir: str = 'games') -> Tuple[Dict[str, Any], int]:
    """Return basic player information including faction and resources."""
    db_path = get_game_db_path(game_name, games_dir)
    if not os.path.exists(db_path):
        logger.warning("Requested player profile for non-existent game '%s'", game_name)
        return {"error": "Game not found"}, 404

    try:
        player = execute_query(
            db_path,
            """
                SELECT playerId,
                       name,
                       faction,
                       resources,
                       influence,
                       commodities,
                       trade_goods AS tradeGoods,
                       victoryPoints
                FROM players
                WHERE playerId = ?
            """,
            (player_id,),
            fetch_one=True
        )
    except DatabaseError as exc:
        logger.error("Failed to fetch player profile for '%s' in '%s': %s", player_id, game_name, exc)
        return {"error": "Unable to load player"}, 500

    if not player:
        return {"error": "Player not found"}, 404

    player['faction'] = (player.get('faction') or 'none').lower()
    numeric_fields = ['resources', 'influence', 'commodities', 'tradeGoods', 'victoryPoints']
    for field in numeric_fields:
        if field in player and player[field] is not None:
            player[field] = int(player[field])

    return {'player': player}, 200


def update_player_economy(
    game_name: str,
    player_id: str,
    trade_goods: Optional[int],
    commodities: Optional[int],
    games_dir: str = 'games'
) -> Tuple[Dict[str, Any], int]:
    """Update a player's trade goods and commodity totals."""
    db_path = get_game_db_path(game_name, games_dir)
    if not os.path.exists(db_path):
        logger.warning("Attempted to update economy for non-existent game '%s'", game_name)
        return {"error": "Game not found"}, 404

    if trade_goods is None and commodities is None:
        return {"error": "No economy changes provided"}, 400

    try:
        player = execute_query(
            db_path,
            "SELECT playerId, name, trade_goods, commodities FROM players WHERE playerId = ?",
            (player_id,),
            fetch_one=True
        )
    except DatabaseError as exc:
        logger.error("Failed to load player '%s' for economy update in '%s': %s", player_id, game_name, exc)
        return {"error": "Unable to update player"}, 500

    if not player:
        logger.warning("Player '%s' not found in game '%s' for economy update", player_id, game_name)
        return {"error": "Player not found"}, 404

    def _normalise(value: Optional[int]) -> Optional[int]:
        if value is None:
            return None
        try:
            parsed = int(value)
        except (TypeError, ValueError):
            return None
        return max(parsed, 0)

    updates = []
    params: List[int] = []

    normalised_trade_goods = _normalise(trade_goods)
    normalised_commodities = _normalise(commodities)

    if trade_goods is not None:
        if normalised_trade_goods is None:
            return {"error": "Trade goods must be a number"}, 400
        updates.append("trade_goods = ?")
        params.append(normalised_trade_goods)

    if commodities is not None:
        if normalised_commodities is None:
            return {"error": "Commodities must be a number"}, 400
        updates.append("commodities = ?")
        params.append(normalised_commodities)

    if not updates:
        return {"error": "No valid economy updates supplied"}, 400

    params.append(player_id)

    try:
        execute_query(
            db_path,
            f"UPDATE players SET {', '.join(updates)} WHERE playerId = ?",
            tuple(params)
        )
    except DatabaseError as exc:
        logger.error(
            "Failed to persist economy update for player '%s' in '%s': %s",
            player_id,
            game_name,
            exc
        )
        return {"error": "Failed to update player economy"}, 500

    update_game_timestamp(db_path)

    return {
        'player': {
            'playerId': player_id,
            'name': player.get('name'),
            'tradeGoods': normalised_trade_goods if normalised_trade_goods is not None else player.get('trade_goods', 0),
            'commodities': normalised_commodities if normalised_commodities is not None else player.get('commodities', 0)
        }
    }, 200


def update_player_faction(
    game_name: str,
    player_id: str,
    faction_key_raw: Optional[str],
    games_dir: str = 'games'
) -> Tuple[Dict[str, Any], int]:
    """Assign a faction to a player, updating starting assets accordingly."""
    db_path = get_game_db_path(game_name, games_dir)
    if not os.path.exists(db_path):
        logger.warning("Attempted to set faction for player in non-existent game '%s'", game_name)
        return {"error": "Game not found"}, 404

    try:
        player = execute_query(
            db_path,
            "SELECT playerId, name, faction FROM players WHERE playerId = ?",
            (player_id,),
            fetch_one=True
        )
    except DatabaseError as exc:
        logger.error("Failed to load player '%s' in '%s': %s", player_id, game_name, exc)
        return {"error": "Unable to load player"}, 500

    if not player:
        logger.warning("Player '%s' not found in game '%s' for faction update", player_id, game_name)
        return {"error": "Player not found"}, 404

    new_faction_key = _normalise_faction_key(faction_key_raw)
    old_faction_key = _normalise_faction_key(player.get('faction'))

    if new_faction_key:
        try:
            faction_definition = get_faction_definition(new_faction_key)
        except FactionCatalogError as exc:
            logger.error("Failed to load faction catalog during update: %s", exc)
            return {"error": "Faction catalog unavailable"}, 500

        if not faction_definition:
            logger.warning(
                "Player '%s' attempted to select unknown faction '%s' in game '%s'",
                player_id,
                faction_key_raw,
                game_name
            )
            return {"error": "Unknown faction selection"}, 400

    if new_faction_key == old_faction_key:
        return {
            'player': {
                'playerId': player_id,
                'name': player.get('name'),
                'faction': old_faction_key or 'none',
                'technologyAdded': [],
                'technologyRemoved': [],
                'planetsAdded': [],
                'planetsRemoved': []
            }
        }, 200

    try:
        sync_result = _sync_player_faction_assets(db_path, player_id, new_faction_key, old_faction_key)
    except (DatabaseError, FactionCatalogError):
        return {"error": "Failed to update faction assets"}, 500

    try:
        execute_query(
            db_path,
            "UPDATE players SET faction = ? WHERE playerId = ?",
            (new_faction_key, player_id)
        )
    except DatabaseError as exc:
        logger.error(
            "Failed to update faction column for player '%s' in '%s': %s",
            player_id,
            game_name,
            exc
        )
        # Attempt to revert assets so the player remains consistent with their stored faction
        try:
            _sync_player_faction_assets(db_path, player_id, old_faction_key, new_faction_key)
        except (DatabaseError, FactionCatalogError):
            logger.critical(
                "Failed to restore faction assets for player '%s' in '%s' after update failure",
                player_id,
                game_name
            )
        return {"error": "Failed to update player faction"}, 500

    update_game_timestamp(db_path)

    return {
        'player': {
            'playerId': player_id,
            'name': player.get('name'),
            'faction': new_faction_key or 'none',
            **sync_result
        }
    }, 200
