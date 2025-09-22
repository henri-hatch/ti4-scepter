import os
import logging
from typing import Dict, Any, List, Tuple, Optional

from components.database import execute_query, DatabaseError
from components.planet_catalog import (
    load_planet_catalog,
    list_planet_definitions,
    get_planet_definition,
    populate_planet_definitions,
    ensure_planet_tables
)
from components.exploration_catalog import (
    ensure_exploration_tables,
    populate_exploration_definitions,
    list_planet_attachments_for_player,
    ExplorationCatalogError
)
from routes.games import get_game_db_path, update_game_timestamp

logger = logging.getLogger(__name__)


def _ensure_game_database(game_name: str, games_dir: str) -> Tuple[bool, str]:
    """Validate that a game's database exists and return its path."""
    db_path = get_game_db_path(game_name, games_dir)
    if not os.path.exists(db_path):
        logger.warning("Requested game '%s' does not exist at %s", game_name, db_path)
        return False, db_path
    return True, db_path


def _normalise_planet_rows(rows: List[Dict], attachments: Optional[Dict[str, List[Dict]]] = None) -> List[Dict]:
    """Convert sqlite boolean/int fields to expected Python types."""
    normalised: List[Dict] = []
    for row in rows:
        converted = {
            **row,
            'legendary': bool(row.get('legendary', 0))
        }
        if 'isExhausted' in row:
            converted['isExhausted'] = bool(row.get('isExhausted', 0))
        planet_key = row.get('key')
        if attachments and planet_key in attachments:
            converted['attachments'] = attachments[planet_key]
        else:
            converted['attachments'] = []
        normalised.append(converted)
    return normalised


def list_catalog_planets() -> Dict[str, Any]:
    """Return the base catalog of planets for selection menus."""
    planets = load_planet_catalog()
    return {'planets': planets}


def list_player_planets(game_name: str, player_id: str, games_dir: str) -> Tuple[Dict[str, Any], int]:
    """Return the planets currently owned by a player."""
    valid, db_path = _ensure_game_database(game_name, games_dir)
    if not valid:
        return {"error": "Game not found"}, 404

    ensure_planet_tables(db_path)
    populate_planet_definitions(db_path)

    attachment_map: Dict[str, List[Dict]] = {}
    try:
        ensure_exploration_tables(db_path)
        populate_exploration_definitions(db_path)
        attachment_map = list_planet_attachments_for_player(db_path, player_id)
    except (ExplorationCatalogError, DatabaseError) as exc:
        logger.error("Failed to load planet attachments for game '%s': %s", game_name, exc)
        attachment_map = {}

    try:
        rows = execute_query(
            db_path,
            """
                SELECT pp.planetKey as key,
                       pd.name,
                       pd.type,
                       pd.techSpecialty,
                       pd.resources,
                       pd.influence,
                       pd.legendary,
                       pd.assetFront,
                       pd.assetBack,
                       pp.isExhausted
                FROM playerPlanets pp
                JOIN planetDefinitions pd ON pd.planetKey = pp.planetKey
                WHERE pp.playerId = ?
                ORDER BY pd.name
            """,
            (player_id,),
            fetch_all=True
        ) or []
    except DatabaseError as exc:
        logger.error("Failed to fetch planets for game '%s': %s", game_name, exc)
        return {"error": "Failed to load player planets"}, 500

    return {"planets": _normalise_planet_rows(rows, attachment_map)}, 200


def add_player_planet(game_name: str, player_id: str, planet_key: str, games_dir: str) -> Tuple[Dict[str, Any], int]:
    """Add a planet to a player's inventory."""
    valid, db_path = _ensure_game_database(game_name, games_dir)
    if not valid:
        return {"error": "Game not found"}, 404

    if not planet_key:
        return {"error": "Planet key is required"}, 400

    ensure_planet_tables(db_path)
    populate_planet_definitions(db_path)

    definition = get_planet_definition(db_path, planet_key)
    if not definition:
        return {"error": "Planet not found"}, 404

    try:
        existing = execute_query(
            db_path,
            "SELECT 1 FROM playerPlanets WHERE playerId = ? AND planetKey = ?",
            (player_id, planet_key),
            fetch_one=True
        )
    except DatabaseError as exc:
        logger.error("Failed to check existing planet for '%s': %s", game_name, exc)
        return {"error": "Unable to add planet"}, 500

    if existing:
        return {"error": "Planet already owned"}, 409

    try:
        execute_query(
            db_path,
            "INSERT INTO playerPlanets (playerId, planetKey) VALUES (?, ?)",
            (player_id, planet_key),
            fetch_all=False
        )
    except DatabaseError as exc:
        logger.error("Failed to add planet '%s' for player '%s' in '%s': %s", planet_key, player_id, game_name, exc)
        return {"error": "Unable to add planet"}, 500

    update_game_timestamp(db_path)

    definition['legendary'] = bool(definition.get('legendary', 0))
    definition['isExhausted'] = False
    return {"planet": definition}, 201


def update_player_planet_state(game_name: str, player_id: str, planet_key: str, is_exhausted: bool, games_dir: str) -> Tuple[Dict[str, Any], int]:
    """Update whether a planet is exhausted (card flipped)."""
    valid, db_path = _ensure_game_database(game_name, games_dir)
    if not valid:
        return {"error": "Game not found"}, 404

    ensure_planet_tables(db_path)

    try:
        updated = execute_query(
            db_path,
            "UPDATE playerPlanets SET isExhausted = ? WHERE playerId = ? AND planetKey = ?",
            (1 if is_exhausted else 0, player_id, planet_key),
            fetch_all=False
        )
    except DatabaseError as exc:
        logger.error("Failed to update planet state for '%s' in '%s': %s", planet_key, game_name, exc)
        return {"error": "Unable to update planet"}, 500

    if not updated:
        return {"error": "Planet not assigned to player"}, 404

    update_game_timestamp(db_path)

    planet = get_planet_definition(db_path, planet_key)
    if planet:
        planet['legendary'] = bool(planet.get('legendary', 0))
        planet['isExhausted'] = is_exhausted
    else:
        planet = {"key": planet_key, "isExhausted": is_exhausted}

    return {"planet": planet}, 200


def remove_player_planet(game_name: str, player_id: str, planet_key: str, games_dir: str) -> Tuple[Dict[str, Any], int]:
    """Remove a planet from a player's inventory."""
    valid, db_path = _ensure_game_database(game_name, games_dir)
    if not valid:
        return {"error": "Game not found"}, 404

    ensure_planet_tables(db_path)

    try:
        deleted = execute_query(
            db_path,
            "DELETE FROM playerPlanets WHERE playerId = ? AND planetKey = ?",
            (player_id, planet_key),
            fetch_all=False
        )
    except DatabaseError as exc:
        logger.error("Failed to delete planet '%s' for player '%s' in '%s': %s", planet_key, player_id, game_name, exc)
        return {"error": "Unable to delete planet"}, 500

    if not deleted:
        return {"error": "Planet not assigned to player"}, 404

    update_game_timestamp(db_path)
    return {"success": True}, 200


def list_game_planet_definitions(game_name: str, games_dir: str) -> Tuple[Dict[str, Any], int]:
    """Return planet definitions for a specific game database."""
    valid, db_path = _ensure_game_database(game_name, games_dir)
    if not valid:
        return {"error": "Game not found"}, 404

    ensure_planet_tables(db_path)
    populate_planet_definitions(db_path)

    try:
        rows = list_planet_definitions(db_path)
    except DatabaseError as exc:
        logger.error("Failed to list planet definitions for '%s': %s", game_name, exc)
        return {"error": "Unable to load planets"}, 500

    return {"planets": _normalise_planet_rows(rows)}, 200
