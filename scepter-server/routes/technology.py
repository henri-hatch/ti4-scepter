import os
import logging
from typing import Dict, Any, List, Tuple, Optional

from components.database import execute_query, DatabaseError
from components.technology_catalog import (
    ensure_technology_tables,
    populate_technology_definitions,
    list_technology_definitions,
    get_technology_definition,
    list_catalog_technology,
    TechnologyCatalogError
)
from routes.games import get_game_db_path, update_game_timestamp

logger = logging.getLogger(__name__)


TechnologyRow = Dict[str, Any]


def _ensure_game_database(game_name: str, games_dir: str) -> Tuple[bool, str]:
    """Validate that a game's database exists and return its path."""
    db_path = get_game_db_path(game_name, games_dir)
    if not os.path.exists(db_path):
        logger.warning("Requested game '%s' does not exist at %s", game_name, db_path)
        return False, db_path
    return True, db_path


def _normalise_technology_rows(rows: List[TechnologyRow]) -> List[TechnologyRow]:
    """Convert sqlite boolean/int fields to expected Python types."""
    normalised: List[TechnologyRow] = []
    for row in rows:
        item = {
            **row,
            'faction': (row.get('faction') or 'none').lower(),
            'tier': int(row.get('tier', 0))
        }
        if 'isExhausted' in row:
            item['isExhausted'] = bool(row.get('isExhausted', 0))
        normalised.append(item)
    return normalised


def _fetch_player(db_path: str, player_id: str) -> Optional[TechnologyRow]:
    """Return the player's record including faction information."""
    player = execute_query(
        db_path,
        "SELECT playerId, name, faction FROM players WHERE playerId = ?",
        (player_id,),
        fetch_one=True
    )

    if not player:
        return None

    player['faction'] = (player.get('faction') or 'none').lower()
    return player


def list_catalog_technologies() -> Dict[str, Any]:
    """Return the base technology catalog for selection menus."""
    technology = list_catalog_technology()
    return technology


def list_player_technologies(game_name: str, player_id: str, games_dir: str) -> Tuple[Dict[str, Any], int]:
    """Return the technology cards currently owned by a player."""
    valid, db_path = _ensure_game_database(game_name, games_dir)
    if not valid:
        return {"error": "Game not found"}, 404

    ensure_technology_tables(db_path)
    try:
        populate_technology_definitions(db_path)
    except (TechnologyCatalogError, DatabaseError) as exc:
        logger.error("Failed to populate technology catalog for '%s': %s", game_name, exc)
        return {"error": "Technology catalog unavailable"}, 500

    try:
        rows = execute_query(
            db_path,
            """
                SELECT pt.technologyKey AS key,
                       td.name,
                       td.type,
                       td.faction,
                       td.tier,
                       td.asset,
                       pt.isExhausted
                FROM playerTechnologies pt
                JOIN technologyDefinitions td ON td.technologyKey = pt.technologyKey
                WHERE pt.playerId = ?
                ORDER BY td.type, td.tier, td.name
            """,
            (player_id,),
            fetch_all=True
        ) or []
    except DatabaseError as exc:
        logger.error("Failed to fetch technology for game '%s': %s", game_name, exc)
        return {"error": "Failed to load player technology"}, 500

    return {"technology": _normalise_technology_rows(rows)}, 200


def add_player_technology(game_name: str, player_id: str, technology_key: str, games_dir: str) -> Tuple[Dict[str, Any], int]:
    """Add a technology card to a player's inventory."""
    valid, db_path = _ensure_game_database(game_name, games_dir)
    if not valid:
        return {"error": "Game not found"}, 404

    if not technology_key:
        return {"error": "Technology key is required"}, 400

    ensure_technology_tables(db_path)
    try:
        populate_technology_definitions(db_path)
        definition = get_technology_definition(db_path, technology_key)
    except (TechnologyCatalogError, DatabaseError) as exc:
        logger.error("Failed to access technology catalog for '%s': %s", game_name, exc)
        return {"error": "Technology catalog unavailable"}, 500
    if not definition:
        return {"error": "Technology not found"}, 404

    try:
        player = _fetch_player(db_path, player_id)
    except DatabaseError as exc:
        logger.error("Failed to fetch player '%s' for technology add in '%s': %s", player_id, game_name, exc)
        return {"error": "Unable to add technology"}, 500

    if player is None:
        return {"error": "Player not found"}, 404

    faction = player.get('faction') or 'none'
    tech_faction = definition.get('faction') or 'none'
    if tech_faction not in ('none', faction):
        logger.warning(
            "Player '%s' attempted to claim faction technology '%s' (%s)",
            player_id,
            technology_key,
            tech_faction
        )
        return {"error": "Technology unavailable for this faction"}, 403

    try:
        existing = execute_query(
            db_path,
            "SELECT 1 FROM playerTechnologies WHERE playerId = ? AND technologyKey = ?",
            (player_id, technology_key),
            fetch_one=True
        )
    except DatabaseError as exc:
        logger.error("Failed to check existing technology for '%s': %s", game_name, exc)
        return {"error": "Unable to add technology"}, 500

    if existing:
        return {"error": "Technology already learned"}, 409

    try:
        execute_query(
            db_path,
            "INSERT INTO playerTechnologies (playerId, technologyKey) VALUES (?, ?)",
            (player_id, technology_key),
            fetch_all=False
        )
    except DatabaseError as exc:
        logger.error(
            "Failed to add technology '%s' for player '%s' in '%s': %s",
            technology_key,
            player_id,
            game_name,
            exc
        )
        return {"error": "Unable to add technology"}, 500

    update_game_timestamp(db_path)

    definition['isExhausted'] = False
    return {"technology": definition}, 201


def update_player_technology_state(
    game_name: str,
    player_id: str,
    technology_key: str,
    is_exhausted: bool,
    games_dir: str
) -> Tuple[Dict[str, Any], int]:
    """Update whether a technology card is exhausted (flipped)."""
    valid, db_path = _ensure_game_database(game_name, games_dir)
    if not valid:
        return {"error": "Game not found"}, 404

    ensure_technology_tables(db_path)

    try:
        updated = execute_query(
            db_path,
            "UPDATE playerTechnologies SET isExhausted = ? WHERE playerId = ? AND technologyKey = ?",
            (1 if is_exhausted else 0, player_id, technology_key),
            fetch_all=False
        )
    except DatabaseError as exc:
        logger.error(
            "Failed to update technology state for '%s' in '%s': %s",
            technology_key,
            game_name,
            exc
        )
        return {"error": "Unable to update technology"}, 500

    if not updated:
        return {"error": "Technology not assigned to player"}, 404

    update_game_timestamp(db_path)

    technology = get_technology_definition(db_path, technology_key)
    if technology:
        technology['isExhausted'] = is_exhausted
    else:
        technology = {"key": technology_key, "isExhausted": is_exhausted}

    return {"technology": technology}, 200


def remove_player_technology(game_name: str, player_id: str, technology_key: str, games_dir: str) -> Tuple[Dict[str, Any], int]:
    """Remove a technology card from a player's inventory."""
    valid, db_path = _ensure_game_database(game_name, games_dir)
    if not valid:
        return {"error": "Game not found"}, 404

    ensure_technology_tables(db_path)

    try:
        deleted = execute_query(
            db_path,
            "DELETE FROM playerTechnologies WHERE playerId = ? AND technologyKey = ?",
            (player_id, technology_key),
            fetch_all=False
        )
    except DatabaseError as exc:
        logger.error(
            "Failed to delete technology '%s' for player '%s' in '%s': %s",
            technology_key,
            player_id,
            game_name,
            exc
        )
        return {"error": "Unable to delete technology"}, 500

    if not deleted:
        return {"error": "Technology not assigned to player"}, 404

    update_game_timestamp(db_path)
    return {"success": True}, 200


def list_player_technology_definitions(
    game_name: str,
    player_id: str,
    games_dir: str
) -> Tuple[Dict[str, Any], int]:
    """Return technology definitions available to a player (including faction tech)."""
    valid, db_path = _ensure_game_database(game_name, games_dir)
    if not valid:
        return {"error": "Game not found"}, 404

    ensure_technology_tables(db_path)
    try:
        populate_technology_definitions(db_path)
    except (TechnologyCatalogError, DatabaseError) as exc:
        logger.error("Failed to populate technology catalog for '%s': %s", game_name, exc)
        return {"error": "Technology catalog unavailable"}, 500

    try:
        player = _fetch_player(db_path, player_id)
    except DatabaseError as exc:
        logger.error("Failed to fetch player '%s' for technology definitions in '%s': %s", player_id, game_name, exc)
        return {"error": "Unable to load technology"}, 500

    if player is None:
        return {"error": "Player not found"}, 404

    try:
        definitions = list_technology_definitions(db_path)
    except (DatabaseError, TechnologyCatalogError) as exc:
        logger.error("Failed to list technology definitions for '%s': %s", game_name, exc)
        return {"error": "Unable to load technology"}, 500

    faction = player.get('faction') or 'none'
    allowed = [
        definition for definition in definitions
        if definition.get('faction') in ('none', faction)
    ]

    return {"technology": allowed}, 200
