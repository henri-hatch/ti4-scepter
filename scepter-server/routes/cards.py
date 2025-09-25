import os
import random
import logging
from typing import Any, Dict, List, Optional, Sequence, Tuple

from components.database import execute_query, DatabaseError, get_db_connection
from components.action_catalog import (
  ensure_action_tables,
  populate_action_definitions,
  list_action_definitions,
  get_action_definition,
  list_catalog_actions,
  ActionCatalogError
)
from components.exploration_catalog import (
  ensure_exploration_tables,
  populate_exploration_definitions,
  list_catalog_exploration,
  list_player_exploration_cards as fetch_player_exploration_cards,
  add_player_exploration_card,
  update_player_exploration_state,
  remove_player_exploration_card,
  add_planet_attachment,
  remove_planet_attachment,
  list_planet_attachments_for_player,
  list_available_exploration_definitions,
  get_exploration_definition,
  ExplorationCatalogError
)
from components.planet_catalog import ensure_planet_tables, get_planet_definition
from components.strategem_catalog import (
  ensure_strategem_tables,
  populate_strategem_definitions,
  get_strategem_definition,
  list_player_strategems as fetch_player_strategems,
  list_available_strategem_definitions,
  add_player_strategem as assign_player_strategem,
  update_player_strategem_state as set_player_strategem_state,
  remove_player_strategem as delete_player_strategem,
  update_strategem_trade_goods as set_strategem_trade_goods,
  StrategemCatalogError
)
from components.objective_catalog import (
  ensure_objective_tables,
  populate_objective_definitions,
  list_player_objectives as fetch_player_objectives,
  list_available_objective_definitions,
  add_player_objective as assign_player_objective,
  update_player_objective_state as set_player_objective_state,
  remove_player_objective as delete_player_objective,
  draw_random_objective_for_player,
  get_objective_definition,
  list_public_objective_progress,
  ObjectiveCatalogError
)
from routes.games import get_game_db_path, update_game_timestamp

logger = logging.getLogger(__name__)


ActionRow = Dict[str, Any]
ExplorationRow = Dict[str, Any]
StrategemRow = Dict[str, Any]
ObjectiveRow = Dict[str, Any]


def _ensure_game_database(game_name: str, games_dir: str) -> Tuple[bool, str]:
  """Validate that a game's database exists and return its path."""
  db_path = get_game_db_path(game_name, games_dir)
  if not os.path.exists(db_path):
    logger.warning("Requested game '%s' does not exist at %s", game_name, db_path)
    return False, db_path
  return True, db_path


def _fetch_player_name(db_path: str, player_id: str) -> Optional[str]:
  """Return the player's display name for logging."""
  try:
    row = execute_query(
      db_path,
      "SELECT name FROM players WHERE playerId = ?",
      (player_id,),
      fetch_one=True
    )
  except DatabaseError as exc:
    logger.error("Failed to fetch player '%s' for logging: %s", player_id, exc)
    return None

  if not row:
    return None

  return row.get('name')


def _normalise_action_rows(rows: Sequence[ActionRow]) -> List[ActionRow]:
  """Convert sqlite integer flags to booleans for action cards."""
  normalised: List[ActionRow] = []
  for row in rows:
    item = dict(row)
    if 'isExhausted' in item:
      item['isExhausted'] = bool(item.get('isExhausted', 0))
    normalised.append(item)
  return normalised


def _normalise_exploration_rows(rows: Sequence[ExplorationRow]) -> List[ExplorationRow]:
  """Convert sqlite integer flags to booleans for exploration cards."""
  normalised: List[ExplorationRow] = []
  for row in rows:
    item = dict(row)
    if 'isExhausted' in item:
      item['isExhausted'] = bool(item.get('isExhausted', 0))
    normalised.append(item)
  return normalised


def _normalise_strategem_rows(rows: Sequence[StrategemRow]) -> List[StrategemRow]:
  """Convert sqlite integer flags to booleans for strategem cards."""
  normalised: List[StrategemRow] = []
  for row in rows:
    item = dict(row)
    if 'isExhausted' in item:
      item['isExhausted'] = bool(item.get('isExhausted', 0))
    if 'tradeGoods' in item and item['tradeGoods'] is not None:
      item['tradeGoods'] = int(item['tradeGoods'])
    normalised.append(item)
  return normalised


def _normalise_objective_rows(rows: Sequence[ObjectiveRow]) -> List[ObjectiveRow]:
  """Convert sqlite integer flags to booleans for objectives."""
  normalised: List[ObjectiveRow] = []
  for row in rows:
    item = dict(row)
    if 'isCompleted' in item:
      item['isCompleted'] = bool(item.get('isCompleted', 0))
    if 'victoryPoints' in item and item['victoryPoints'] is not None:
      item['victoryPoints'] = int(item['victoryPoints'])
    if 'slotIndex' in item and item['slotIndex'] is not None:
      item['slotIndex'] = int(item['slotIndex'])
    normalised.append(item)
  return normalised


# Action Cards -----------------------------------------------------------------

def list_player_actions(game_name: str, player_id: str, games_dir: str) -> Tuple[Dict[str, Any], int]:
  """Return the action cards currently owned by a player."""
  valid, db_path = _ensure_game_database(game_name, games_dir)
  if not valid:
    return {"error": "Game not found"}, 404

  ensure_action_tables(db_path)
  try:
    populate_action_definitions(db_path)
  except (ActionCatalogError, DatabaseError) as exc:
    logger.error("Failed to populate action catalog for '%s': %s", game_name, exc)
    return {"error": "Action card catalog unavailable"}, 500

  try:
    rows = execute_query(
      db_path,
      """
          SELECT pa.actionKey AS key,
                 ad.name,
                 ad.asset,
                 pa.isExhausted,
                 pa.acquiredAt
          FROM playerActions pa
          JOIN actionDefinitions ad ON ad.actionKey = pa.actionKey
          WHERE pa.playerId = ?
          ORDER BY ad.name
      """,
      (player_id,),
      fetch_all=True
    ) or []
  except DatabaseError as exc:
    logger.error("Failed to fetch action cards for game '%s': %s", game_name, exc)
    return {"error": "Failed to load player action cards"}, 500

  return {"actions": _normalise_action_rows(rows)}, 200


def list_player_action_definitions(game_name: str, player_id: str, games_dir: str) -> Tuple[Dict[str, Any], int]:
  """Return action card definitions that the player does not yet own."""
  valid, db_path = _ensure_game_database(game_name, games_dir)
  if not valid:
    return {"error": "Game not found"}, 404

  ensure_action_tables(db_path)
  try:
    populate_action_definitions(db_path)
    definitions = list_action_definitions(db_path)
  except (ActionCatalogError, DatabaseError) as exc:
    logger.error("Failed to access action catalog for '%s': %s", game_name, exc)
    return {"error": "Action card catalog unavailable"}, 500

  try:
    owned_rows = execute_query(
      db_path,
      "SELECT actionKey FROM playerActions WHERE playerId = ?",
      (player_id,),
      fetch_all=True
    ) or []
  except DatabaseError as exc:
    logger.error("Failed to fetch existing action cards for '%s': %s", game_name, exc)
    return {"error": "Unable to load action cards"}, 500

  owned = {row['actionKey'] for row in owned_rows}
  available = [definition for definition in definitions if definition['key'] not in owned]
  return {"actions": available}, 200


def add_player_action(game_name: str, player_id: str, action_key: str, games_dir: str) -> Tuple[Dict[str, Any], int]:
  """Assign an action card to a player's inventory."""
  valid, db_path = _ensure_game_database(game_name, games_dir)
  if not valid:
    return {"error": "Game not found"}, 404

  if not action_key:
    return {"error": "Action key is required"}, 400

  ensure_action_tables(db_path)
  try:
    populate_action_definitions(db_path)
    definition = get_action_definition(db_path, action_key)
  except (ActionCatalogError, DatabaseError) as exc:
    logger.error("Failed to access action catalog for '%s': %s", game_name, exc)
    return {"error": "Action card catalog unavailable"}, 500

  if not definition:
    return {"error": "Action card not found"}, 404

  try:
    existing = execute_query(
      db_path,
      "SELECT 1 FROM playerActions WHERE playerId = ? AND actionKey = ?",
      (player_id, action_key),
      fetch_one=True
    )
  except DatabaseError as exc:
    logger.error("Failed to check existing action card for '%s': %s", game_name, exc)
    return {"error": "Unable to add action card"}, 500

  if existing:
    return {"error": "Action card already owned"}, 409

  try:
    execute_query(
      db_path,
      "INSERT INTO playerActions (playerId, actionKey) VALUES (?, ?)",
      (player_id, action_key),
      fetch_all=False
    )
  except DatabaseError as exc:
    logger.error(
      "Failed to add action card '%s' for player '%s' in '%s': %s",
      action_key,
      player_id,
      game_name,
      exc
    )
    return {"error": "Unable to add action card"}, 500

  update_game_timestamp(db_path)

  definition['isExhausted'] = False
  return {"action": definition}, 201


def update_player_action_state(
  game_name: str,
  player_id: str,
  action_key: str,
  is_exhausted: bool,
  games_dir: str
) -> Tuple[Dict[str, Any], int]:
  """Update whether an action card is exhausted (flipped)."""
  valid, db_path = _ensure_game_database(game_name, games_dir)
  if not valid:
    return {"error": "Game not found"}, 404

  ensure_action_tables(db_path)

  try:
    updated = execute_query(
      db_path,
      "UPDATE playerActions SET isExhausted = ? WHERE playerId = ? AND actionKey = ?",
      (1 if is_exhausted else 0, player_id, action_key),
      fetch_all=False
    )
  except DatabaseError as exc:
    logger.error("Failed to update action card state for '%s' in '%s': %s", action_key, game_name, exc)
    return {"error": "Unable to update action card"}, 500

  if not updated:
    return {"error": "Action card not assigned to player"}, 404

  update_game_timestamp(db_path)

  card = get_action_definition(db_path, action_key) or {"key": action_key}
  card['isExhausted'] = is_exhausted
  return {"action": card}, 200


def remove_player_action(game_name: str, player_id: str, action_key: str, games_dir: str) -> Tuple[Dict[str, Any], int]:
  """Remove an action card from a player's inventory."""
  valid, db_path = _ensure_game_database(game_name, games_dir)
  if not valid:
    return {"error": "Game not found"}, 404

  ensure_action_tables(db_path)

  try:
    deleted = execute_query(
      db_path,
      "DELETE FROM playerActions WHERE playerId = ? AND actionKey = ?",
      (player_id, action_key),
      fetch_all=False
    )
  except DatabaseError as exc:
    logger.error("Failed to delete action card '%s' for player '%s' in '%s': %s", action_key, player_id, game_name, exc)
    return {"error": "Unable to delete action card"}, 500

  if not deleted:
    return {"error": "Action card not assigned to player"}, 404

  update_game_timestamp(db_path)
  return {"success": True}, 200


def draw_random_action(game_name: str, player_id: str, games_dir: str) -> Tuple[Dict[str, Any], int]:
  """Randomly select an action card the player does not already own."""
  valid, db_path = _ensure_game_database(game_name, games_dir)
  if not valid:
    return {"error": "Game not found"}, 404

  ensure_action_tables(db_path)
  try:
    populate_action_definitions(db_path)
    definitions = list_action_definitions(db_path)
  except (ActionCatalogError, DatabaseError) as exc:
    logger.error("Failed to access action catalog for '%s': %s", game_name, exc)
    return {"error": "Action card catalog unavailable"}, 500

  try:
    owned_rows = execute_query(
      db_path,
      "SELECT actionKey FROM playerActions WHERE playerId = ?",
      (player_id,),
      fetch_all=True
    ) or []
  except DatabaseError as exc:
    logger.error("Failed to fetch action ownership for '%s': %s", game_name, exc)
    return {"error": "Unable to draw action card"}, 500

  owned = {row['actionKey'] for row in owned_rows}
  available = [definition for definition in definitions if definition['key'] not in owned]

  if not available:
    return {"error": "No action cards available to draw"}, 409

  choice = random.choice(available)
  return {"action": choice}, 200


# Exploration Cards -----------------------------------------------------------

def list_player_exploration_cards(game_name: str, player_id: str, games_dir: str) -> Tuple[Dict[str, Any], int]:
  """Return the exploration cards currently owned by a player."""
  valid, db_path = _ensure_game_database(game_name, games_dir)
  if not valid:
    return {"error": "Game not found"}, 404

  ensure_exploration_tables(db_path)
  try:
    populate_exploration_definitions(db_path)
    rows = fetch_player_exploration_cards(db_path, player_id)
  except (ExplorationCatalogError, DatabaseError) as exc:
    logger.error("Failed to load exploration cards for '%s': %s", game_name, exc)
    return {"error": "Unable to load exploration cards"}, 500

  return {"exploration": _normalise_exploration_rows(rows)}, 200


def list_player_exploration_definitions(
  game_name: str,
  player_id: str,
  subtypes: Sequence[str],
  games_dir: str,
  planet_key: Optional[str] = None
) -> Tuple[Dict[str, Any], int]:
  """Return exploration definitions filtered by subtype for manual selection."""
  valid, db_path = _ensure_game_database(game_name, games_dir)
  if not valid:
    return {"error": "Game not found"}, 404

  try:
    ensure_exploration_tables(db_path)
    populate_exploration_definitions(db_path)
    exclude_planet = planet_key if any(subtype == 'attach' for subtype in subtypes) else None
    definitions = list_available_exploration_definitions(db_path, player_id, subtypes, exclude_planet)
  except (ExplorationCatalogError, DatabaseError) as exc:
    logger.error("Failed to load exploration definitions for '%s': %s", game_name, exc)
    return {"error": "Exploration catalog unavailable"}, 500

  return {"exploration": definitions}, 200


def add_player_exploration(
  game_name: str,
  player_id: str,
  exploration_key: str,
  games_dir: str
) -> Tuple[Dict[str, Any], int]:
  """Assign an exploration card to a player's inventory."""
  valid, db_path = _ensure_game_database(game_name, games_dir)
  if not valid:
    return {"error": "Game not found"}, 404

  if not exploration_key:
    return {"error": "Exploration key is required"}, 400

  try:
    ensure_exploration_tables(db_path)
    populate_exploration_definitions(db_path)
    definition = add_player_exploration_card(db_path, player_id, exploration_key)
  except ExplorationCatalogError as exc:
    logger.error("Exploration catalog error for '%s': %s", game_name, exc)
    return {"error": str(exc)}, 400
  except DatabaseError as exc:
    logger.error("Failed to add exploration card '%s' in '%s': %s", exploration_key, game_name, exc)
    return {"error": "Unable to add exploration card"}, 500

  if definition is None:
    return {"error": "Exploration card already owned"}, 409

  update_game_timestamp(db_path)
  return {"exploration": definition}, 201


def update_player_exploration(
  game_name: str,
  player_id: str,
  exploration_key: str,
  is_exhausted: bool,
  games_dir: str
) -> Tuple[Dict[str, Any], int]:
  """Update the exhausted state of an exploration card."""
  valid, db_path = _ensure_game_database(game_name, games_dir)
  if not valid:
    return {"error": "Game not found"}, 404

  ensure_exploration_tables(db_path)

  try:
    updated = update_player_exploration_state(db_path, player_id, exploration_key, is_exhausted)
  except DatabaseError as exc:
    logger.error("Failed to update exploration state for '%s' in '%s': %s", exploration_key, game_name, exc)
    return {"error": "Unable to update exploration card"}, 500

  if not updated:
    return {"error": "Exploration card not assigned to player"}, 404

  update_game_timestamp(db_path)
  card = get_exploration_definition(db_path, exploration_key) or {"key": exploration_key}
  card['isExhausted'] = is_exhausted
  return {"exploration": card}, 200


def remove_player_exploration(
  game_name: str,
  player_id: str,
  exploration_key: str,
  games_dir: str
) -> Tuple[Dict[str, Any], int]:
  """Remove an exploration card from the player's inventory."""
  valid, db_path = _ensure_game_database(game_name, games_dir)
  if not valid:
    return {"error": "Game not found"}, 404

  ensure_exploration_tables(db_path)

  try:
    deleted = remove_player_exploration_card(db_path, player_id, exploration_key)
  except DatabaseError as exc:
    logger.error("Failed to delete exploration card '%s' for player '%s' in '%s': %s", exploration_key, player_id, game_name, exc)
    return {"error": "Unable to delete exploration card"}, 500

  if not deleted:
    return {"error": "Exploration card not assigned to player"}, 404

  update_game_timestamp(db_path)
  return {"success": True}, 200


def list_player_strategems(game_name: str, player_id: str, games_dir: str) -> Tuple[Dict[str, Any], int]:
  """Return the strategems currently assigned to a player."""
  valid, db_path = _ensure_game_database(game_name, games_dir)
  if not valid:
    return {"error": "Game not found"}, 404

  ensure_strategem_tables(db_path)
  try:
    populate_strategem_definitions(db_path)
    rows = fetch_player_strategems(db_path, player_id)
  except (StrategemCatalogError, DatabaseError) as exc:
    logger.error("Failed to load strategems for '%s': %s", game_name, exc)
    return {"error": "Unable to load strategems"}, 500

  return {"strategems": _normalise_strategem_rows(rows)}, 200


def list_player_strategem_definitions(game_name: str, player_id: str, games_dir: str) -> Tuple[Dict[str, Any], int]:
  """Return strategem definitions that the player does not currently have assigned."""
  valid, db_path = _ensure_game_database(game_name, games_dir)
  if not valid:
    return {"error": "Game not found"}, 404

  try:
    ensure_strategem_tables(db_path)
    populate_strategem_definitions(db_path)
    available = list_available_strategem_definitions(db_path, player_id)
  except (StrategemCatalogError, DatabaseError) as exc:
    logger.error("Failed to load strategem definitions for '%s': %s", game_name, exc)
    return {"error": "Strategem catalog unavailable"}, 500

  return {"strategems": available}, 200


def add_player_strategem(
  game_name: str,
  player_id: str,
  strategem_key: str,
  games_dir: str
) -> Tuple[Dict[str, Any], int]:
  """Assign a strategem to a player's board."""
  valid, db_path = _ensure_game_database(game_name, games_dir)
  if not valid:
    return {"error": "Game not found"}, 404

  if not strategem_key:
    return {"error": "Strategem key is required"}, 400

  try:
    definition = assign_player_strategem(db_path, player_id, strategem_key)
  except StrategemCatalogError as exc:
    logger.error("Strategem catalog error for '%s': %s", game_name, exc)
    message = str(exc) or "Unable to add strategem"
    status = 404 if 'not found' in message.lower() else 400
    return {"error": message}, status
  except DatabaseError as exc:
    logger.error("Failed to add strategem '%s' in '%s': %s", strategem_key, game_name, exc)
    return {"error": "Unable to add strategem"}, 500

  if definition is None:
    return {"error": "Strategem already assigned"}, 409

  update_game_timestamp(db_path)
  definition['isExhausted'] = bool(definition.get('isExhausted', False))
  return {"strategem": definition}, 201


def update_player_strategem(
  game_name: str,
  player_id: str,
  strategem_key: str,
  is_exhausted: bool,
  games_dir: str
) -> Tuple[Dict[str, Any], int]:
  """Update the exhausted state of a strategem on a player's board."""
  valid, db_path = _ensure_game_database(game_name, games_dir)
  if not valid:
    return {"error": "Game not found"}, 404

  ensure_strategem_tables(db_path)

  try:
    updated = set_player_strategem_state(db_path, player_id, strategem_key, is_exhausted)
  except StrategemCatalogError as exc:
    logger.error("Strategem catalog error updating '%s' in '%s': %s", strategem_key, game_name, exc)
    return {"error": str(exc) or "Unable to update strategem"}, 400
  except DatabaseError as exc:
    logger.error("Failed to update strategem '%s' in '%s': %s", strategem_key, game_name, exc)
    return {"error": "Unable to update strategem"}, 500

  if not updated:
    return {"error": "Strategem not assigned to player"}, 404

  update_game_timestamp(db_path)
  card = get_strategem_definition(db_path, strategem_key) or {"key": strategem_key}
  card['isExhausted'] = is_exhausted
  return {"strategem": card}, 200


def remove_player_strategem(
  game_name: str,
  player_id: str,
  strategem_key: str,
  games_dir: str
) -> Tuple[Dict[str, Any], int]:
  """Remove a strategem from a player's board."""
  valid, db_path = _ensure_game_database(game_name, games_dir)
  if not valid:
    return {"error": "Game not found"}, 404

  ensure_strategem_tables(db_path)

  try:
    deleted = delete_player_strategem(db_path, player_id, strategem_key)
  except StrategemCatalogError as exc:
    logger.error("Strategem catalog error removing '%s' in '%s': %s", strategem_key, game_name, exc)
    return {"error": str(exc) or "Unable to remove strategem"}, 400
  except DatabaseError as exc:
    logger.error("Failed to remove strategem '%s' for player '%s' in '%s': %s", strategem_key, player_id, game_name, exc)
    return {"error": "Unable to remove strategem"}, 500

  if not deleted:
    return {"error": "Strategem not assigned to player"}, 404

  update_game_timestamp(db_path)
  return {"success": True}, 200


def update_strategem_trade_goods(
  game_name: str,
  strategem_key: str,
  trade_goods: int,
  games_dir: str
) -> Tuple[Dict[str, Any], int]:
  """Set the trade good count on a strategem for the game."""
  valid, db_path = _ensure_game_database(game_name, games_dir)
  if not valid:
    return {"error": "Game not found"}, 404

  ensure_strategem_tables(db_path)

  try:
    updated = set_strategem_trade_goods(db_path, strategem_key, int(trade_goods))
  except StrategemCatalogError as exc:
    logger.error("Strategem catalog error updating trade goods for '%s' in '%s': %s", strategem_key, game_name, exc)
    return {"error": str(exc) or "Unable to update trade goods"}, 400
  except (DatabaseError, ValueError) as exc:
    logger.error("Failed to update trade goods for strategem '%s' in '%s': %s", strategem_key, game_name, exc)
    return {"error": "Unable to update trade goods"}, 500

  if not updated:
    return {"error": "Strategem not found"}, 404

  update_game_timestamp(db_path)
  return {"strategem": updated}, 200


def list_player_objectives(
  game_name: str,
  player_id: str,
  games_dir: str
) -> Tuple[Dict[str, Any], int]:
  """Return the objectives currently assigned to the player."""
  valid, db_path = _ensure_game_database(game_name, games_dir)
  if not valid:
    return {"error": "Game not found"}, 404

  ensure_objective_tables(db_path)

  try:
    rows = fetch_player_objectives(db_path, player_id)
  except ObjectiveCatalogError as exc:
    logger.error("Objective catalog error for '%s' in '%s': %s", player_id, game_name, exc)
    return {"error": str(exc) or "Objective catalog unavailable"}, 400
  except DatabaseError as exc:
    logger.error("Failed to load objectives for player '%s' in '%s': %s", player_id, game_name, exc)
    return {"error": "Unable to load objectives"}, 500

  return {"objectives": _normalise_objective_rows(rows)}, 200


def list_player_objective_definitions(
  game_name: str,
  player_id: str,
  games_dir: str
) -> Tuple[Dict[str, Any], int]:
  """Return objective definitions that can still be added for the player."""
  valid, db_path = _ensure_game_database(game_name, games_dir)
  if not valid:
    return {"error": "Game not found"}, 404

  ensure_objective_tables(db_path)

  try:
    definitions = list_available_objective_definitions(db_path, player_id)
  except ObjectiveCatalogError as exc:
    logger.error("Objective catalog error listing definitions for '%s' in '%s': %s", player_id, game_name, exc)
    return {"error": str(exc) or "Objective catalog unavailable"}, 400
  except DatabaseError as exc:
    logger.error("Failed to list objective definitions for '%s' in '%s': %s", player_id, game_name, exc)
    return {"error": "Unable to load objective definitions"}, 500

  return {"objectives": _normalise_objective_rows(definitions)}, 200


def add_player_objective(
  game_name: str,
  player_id: str,
  objective_key: str,
  games_dir: str
) -> Tuple[Dict[str, Any], int]:
  """Assign an objective to the player's board."""
  valid, db_path = _ensure_game_database(game_name, games_dir)
  if not valid:
    return {"error": "Game not found"}, 404

  ensure_objective_tables(db_path)

  try:
    added = assign_player_objective(db_path, player_id, objective_key)
  except ObjectiveCatalogError as exc:
    logger.error("Objective catalog error adding '%s' in '%s': %s", objective_key, game_name, exc)
    return {"error": str(exc) or "Unable to add objective"}, 400
  except DatabaseError as exc:
    logger.error("Failed to add objective '%s' for player '%s' in '%s': %s", objective_key, player_id, game_name, exc)
    return {"error": "Unable to add objective"}, 500

  if added is None:
    return {"error": "Objective already assigned"}, 409

  update_game_timestamp(db_path)
  return {"objective": _normalise_objective_rows([added])[0]}, 201


def draw_player_objective(
  game_name: str,
  player_id: str,
  objective_type: str,
  games_dir: str
) -> Tuple[Dict[str, Any], int]:
  """Randomly assign an objective of the requested type to the player."""
  if not objective_type:
    return {"error": "Objective type is required"}, 400

  valid, db_path = _ensure_game_database(game_name, games_dir)
  if not valid:
    return {"error": "Game not found"}, 404

  ensure_objective_tables(db_path)

  try:
    drawn = draw_random_objective_for_player(db_path, player_id, objective_type)
  except ObjectiveCatalogError as exc:
    logger.error(
      "Objective catalog error drawing type '%s' for player '%s' in '%s': %s",
      objective_type,
      player_id,
      game_name,
      exc
    )
    message = str(exc) or "Unable to draw objective"
    lowered = message.lower()
    if 'already assigned' in lowered:
      return {"error": message}, 409
    return {"error": message}, 400
  except DatabaseError as exc:
    logger.error(
      "Failed to draw objective type '%s' for player '%s' in '%s': %s",
      objective_type,
      player_id,
      game_name,
      exc
    )
    return {"error": "Unable to draw objective"}, 500

  if drawn is None:
    return {"error": "No objectives of this type remain"}, 409

  update_game_timestamp(db_path)
  return {"objective": _normalise_objective_rows([drawn])[0]}, 201


def update_player_objective(
  game_name: str,
  player_id: str,
  objective_key: str,
  is_completed: bool,
  games_dir: str
) -> Tuple[Dict[str, Any], int]:
  """Update the completion state of an objective for the player."""
  valid, db_path = _ensure_game_database(game_name, games_dir)
  if not valid:
    return {"error": "Game not found"}, 404

  ensure_objective_tables(db_path)

  try:
    result = set_player_objective_state(db_path, player_id, objective_key, is_completed)
  except ObjectiveCatalogError as exc:
    logger.error("Objective catalog error updating '%s' in '%s': %s", objective_key, game_name, exc)
    return {"error": str(exc) or "Unable to update objective"}, 400
  except DatabaseError as exc:
    logger.error("Failed to update objective '%s' for player '%s' in '%s': %s", objective_key, player_id, game_name, exc)
    return {"error": "Unable to update objective"}, 500

  if not result:
    return {"error": "Objective not assigned to player"}, 404

  objective_payload = result.get('objective') or get_objective_definition(db_path, objective_key) or {'key': objective_key}
  objective_payload['isCompleted'] = bool(result.get('objective', {}).get('isCompleted', is_completed))
  objective_payload['victoryPoints'] = int(objective_payload.get('victoryPoints', 0))
  if 'slotIndex' in objective_payload and objective_payload['slotIndex'] is not None:
    objective_payload['slotIndex'] = int(objective_payload['slotIndex'])
  total_victory = int(result.get('victoryPoints', 0))

  update_game_timestamp(db_path)

  player_name = _fetch_player_name(db_path, player_id) or player_id
  player_faction = str(result.get('playerFaction', 'none') or 'none').lower()
  status = 'completed' if objective_payload['isCompleted'] else 'unscored'
  logger.info(
    "Player '%s' %s objective '%s' for %s VP (total: %s)",
    player_name,
    status,
    objective_payload.get('name', objective_key),
    objective_payload.get('victoryPoints', 0),
    total_victory
  )

  return {
    "objective": _normalise_objective_rows([objective_payload])[0],
    "victoryPoints": total_victory,
    "playerName": player_name,
    "playerId": player_id,
    "playerFaction": player_faction
  }, 200


def remove_player_objective(
  game_name: str,
  player_id: str,
  objective_key: str,
  games_dir: str
) -> Tuple[Dict[str, Any], int]:
  """Remove an objective from the player's board."""
  valid, db_path = _ensure_game_database(game_name, games_dir)
  if not valid:
    return {"error": "Game not found"}, 404

  ensure_objective_tables(db_path)

  try:
    removal = delete_player_objective(db_path, player_id, objective_key)
  except ObjectiveCatalogError as exc:
    logger.error("Objective catalog error removing '%s' in '%s': %s", objective_key, game_name, exc)
    return {"error": str(exc) or "Unable to remove objective"}, 400
  except DatabaseError as exc:
    logger.error("Failed to remove objective '%s' for player '%s' in '%s': %s", objective_key, player_id, game_name, exc)
    return {"error": "Unable to remove objective"}, 500

  if removal is None:
    return {"error": "Objective not assigned to player"}, 404

  update_game_timestamp(db_path)
  victory_points = int(removal.get('victoryPoints', 0))
  response: Dict[str, Any] = {
    "success": True,
    "victoryPoints": victory_points,
    "playerId": removal.get('playerId', player_id)
  }

  if removal.get('removedFromGame'):
    public_payload = {
      'objectiveKey': removal.get('objectiveKey'),
      'type': removal.get('type'),
      'slotIndex': removal.get('slotIndex'),
      'adjustedPlayers': removal.get('adjustedPlayers', [])
    }
    response['removedFromGame'] = True
    response['public'] = public_payload

  return response, 200


def list_public_objectives_summary(
  game_name: str,
  games_dir: str
) -> Tuple[Dict[str, Any], int]:
  """Return the public objectives in play along with scoring players."""
  valid, db_path = _ensure_game_database(game_name, games_dir)
  if not valid:
    return {"error": "Game not found"}, 404

  ensure_objective_tables(db_path)

  try:
    objectives = list_public_objective_progress(db_path)
  except (ObjectiveCatalogError, DatabaseError) as exc:
    logger.error("Failed to list public objectives for '%s': %s", game_name, exc)
    return {"error": "Unable to load public objectives"}, 500

  serialised: List[Dict[str, Any]] = []
  for entry in objectives:
    item = {
      'key': entry.get('key'),
      'name': entry.get('name'),
      'type': entry.get('type'),
      'victoryPoints': int(entry.get('victoryPoints', 0) or 0),
      'asset': entry.get('asset'),
      'slotIndex': entry.get('slotIndex'),
      'addedAt': entry.get('addedAt'),
      'addedBy': entry.get('addedBy'),
      'scoredBy': []  # filled below
    }

    if item['slotIndex'] is not None:
      try:
        item['slotIndex'] = int(item['slotIndex'])
      except (TypeError, ValueError):
        item['slotIndex'] = None

    scored_players = []
    for scored in entry.get('scoredBy', []):
      scored_players.append({
        'playerId': scored.get('playerId'),
        'playerName': scored.get('playerName'),
        'faction': scored.get('faction') or 'none',
        'completedAt': scored.get('completedAt')
      })

    item['scoredBy'] = scored_players
    serialised.append(item)

  return {"objectives": serialised}, 200


def explore_planet(
  game_name: str,
  player_id: str,
  planet_key: str,
  games_dir: str
) -> Tuple[Dict[str, Any], int]:
  """Perform a planet exploration, returning the randomly drawn result."""
  valid, db_path = _ensure_game_database(game_name, games_dir)
  if not valid:
    return {"error": "Game not found"}, 404

  if not planet_key:
    return {"error": "Planet key is required"}, 400

  ensure_planet_tables(db_path)
  ensure_exploration_tables(db_path)

  try:
    owned = execute_query(
      db_path,
      "SELECT 1 FROM playerPlanets WHERE playerId = ? AND planetKey = ?",
      (player_id, planet_key),
      fetch_one=True
    )
  except DatabaseError as exc:
    logger.error("Failed to verify planet ownership for '%s': %s", game_name, exc)
    return {"error": "Unable to explore planet"}, 500

  if not owned:
    return {"error": "Planet not assigned to player"}, 404

  try:
    populate_exploration_definitions(db_path)
  except (ExplorationCatalogError, DatabaseError) as exc:
    logger.error("Failed to access exploration catalog for '%s': %s", game_name, exc)
    return {"error": "Exploration catalog unavailable"}, 500

  planet = get_planet_definition(db_path, planet_key)
  if not planet:
    return {"error": "Planet definition missing"}, 404

  planet_type = planet.get('type')
  if not planet_type:
    return {"error": "Planet type unspecified"}, 400

  try:
    definitions = execute_query(
      db_path,
      """
          SELECT explorationKey AS key,
                 name,
                 type,
                 subtype,
                 asset
          FROM explorationDefinitions
          WHERE type = ?
          ORDER BY subtype, name
      """,
      (planet_type,),
      fetch_all=True
    ) or []
  except DatabaseError as exc:
    logger.error("Failed to fetch exploration definitions for '%s': %s", game_name, exc)
    return {"error": "Exploration catalog unavailable"}, 500

  if not definitions:
    return {"error": "No exploration cards available for this planet"}, 404

  try:
    owned_exploration = execute_query(
      db_path,
      "SELECT explorationKey FROM playerExplorationCards WHERE playerId = ?",
      (player_id,),
      fetch_all=True
    ) or []
    attachment_rows = execute_query(
      db_path,
      "SELECT explorationKey FROM planetAttachments WHERE playerId = ? AND planetKey = ?",
      (player_id, planet_key),
      fetch_all=True
    ) or []
  except DatabaseError as exc:
    logger.error("Failed to determine exploration availability for '%s': %s", game_name, exc)
    return {"error": "Unable to explore planet"}, 500

  owned_keys = {row['explorationKey'] for row in owned_exploration}
  attached_keys = {row['explorationKey'] for row in attachment_rows}

  available = []
  for definition in definitions:
    subtype = definition.get('subtype')
    key = definition.get('key')
    if subtype in ('action', 'relic_fragment') and key in owned_keys:
      continue
    if subtype == 'attach' and key in attached_keys:
      continue
    available.append(definition)

  if not available:
    return {"error": "No exploration cards remaining for this planet"}, 409

  drawn = random.choice(available)
  subtype = drawn.get('subtype')

  if subtype == 'attach':
    try:
      attachment = add_planet_attachment(db_path, player_id, planet_key, drawn['key'])
    except ExplorationCatalogError as exc:
      logger.error("Failed to attach exploration card during explore for '%s': %s", game_name, exc)
      return {"error": str(exc)}, 400
    except DatabaseError as exc:
      logger.error("Database error attaching exploration card in '%s': %s", game_name, exc)
      return {"error": "Unable to attach exploration card"}, 500

    if not attachment:
      return {"error": "Attachment already present"}, 409

    update_game_timestamp(db_path)
    attachment_dict = dict(attachment)
    attachment_dict['subtype'] = 'attach'
    return {
      "result": "attachment",
      "attachment": attachment_dict,
      "planet": {"key": planet_key}
    }, 201

  if subtype == 'relic_fragment':
    try:
      added = add_player_exploration_card(db_path, player_id, drawn['key'])
    except ExplorationCatalogError as exc:
      logger.error("Failed to add exploration relic fragment in '%s': %s", game_name, exc)
      return {"error": str(exc)}, 400
    except DatabaseError as exc:
      logger.error("Database error adding exploration relic fragment in '%s': %s", game_name, exc)
      return {"error": "Unable to add exploration card"}, 500

    if added is None:
      return {"error": "Exploration card already owned"}, 409

    update_game_timestamp(db_path)
    added['subtype'] = 'relic_fragment'
    return {
      "result": "relic_fragment",
      "exploration": added
    }, 201

  # subtype == 'action' falls through here
  return {
    "result": "action",
    "exploration": drawn
  }, 200


def add_attachment_to_planet(
  game_name: str,
  player_id: str,
  planet_key: str,
  exploration_key: str,
  games_dir: str
) -> Tuple[Dict[str, Any], int]:
  """Attach a specific exploration card to the player's planet."""
  valid, db_path = _ensure_game_database(game_name, games_dir)
  if not valid:
    return {"error": "Game not found"}, 404

  ensure_planet_tables(db_path)
  ensure_exploration_tables(db_path)

  try:
    owned = execute_query(
      db_path,
      "SELECT 1 FROM playerPlanets WHERE playerId = ? AND planetKey = ?",
      (player_id, planet_key),
      fetch_one=True
    )
  except DatabaseError as exc:
    logger.error("Failed to verify planet ownership for attachment in '%s': %s", game_name, exc)
    return {"error": "Unable to assign attachment"}, 500

  if not owned:
    return {"error": "Planet not assigned to player"}, 404

  try:
    populate_exploration_definitions(db_path)
    attachment = add_planet_attachment(db_path, player_id, planet_key, exploration_key)
  except ExplorationCatalogError as exc:
    return {"error": str(exc)}, 400
  except DatabaseError as exc:
    logger.error("Failed to add attachment '%s' in '%s': %s", exploration_key, game_name, exc)
    return {"error": "Unable to assign attachment"}, 500

  if attachment is None:
    return {"error": "Attachment already present"}, 409

  update_game_timestamp(db_path)
  attachment_dict = dict(attachment)
  return {"attachment": attachment_dict}, 201


def remove_attachment_from_planet(
  game_name: str,
  player_id: str,
  planet_key: str,
  exploration_key: str,
  games_dir: str
) -> Tuple[Dict[str, Any], int]:
  """Detach an exploration card from the player's planet."""
  valid, db_path = _ensure_game_database(game_name, games_dir)
  if not valid:
    return {"error": "Game not found"}, 404

  ensure_exploration_tables(db_path)

  try:
    deleted = remove_planet_attachment(db_path, player_id, planet_key, exploration_key)
  except DatabaseError as exc:
    logger.error("Failed to remove attachment '%s' in '%s': %s", exploration_key, game_name, exc)
    return {"error": "Unable to remove attachment"}, 500

  if not deleted:
    return {"error": "Attachment not found on planet"}, 404

  update_game_timestamp(db_path)
  return {"success": True}, 200


def restore_relic_from_fragments(
  game_name: str,
  player_id: str,
  fragment_keys: Sequence[str],
  games_dir: str
) -> Tuple[Dict[str, Any], int]:
  """Consume three relic fragments to restore a random relic."""
  if not fragment_keys or len(fragment_keys) != 3:
    return {"error": "Exactly three relic fragments are required"}, 400

  unique_keys = [str(key) for key in fragment_keys]
  if len(set(unique_keys)) != 3:
    return {"error": "Fragments must be distinct"}, 400

  valid, db_path = _ensure_game_database(game_name, games_dir)
  if not valid:
    return {"error": "Game not found"}, 404

  ensure_exploration_tables(db_path)

  placeholders = ','.join('?' for _ in unique_keys)
  try:
    populate_exploration_definitions(db_path)
    rows = execute_query(
      db_path,
      f"""
          SELECT pec.explorationKey AS key,
                 ed.name,
                 ed.type,
                 ed.subtype,
                 ed.asset
          FROM playerExplorationCards pec
          JOIN explorationDefinitions ed ON ed.explorationKey = pec.explorationKey
          WHERE pec.playerId = ?
            AND pec.explorationKey IN ({placeholders})
      """,
      (player_id, *unique_keys),
      fetch_all=True
    ) or []
  except DatabaseError as exc:
    logger.error("Failed to validate relic fragments for '%s': %s", game_name, exc)
    return {"error": "Unable to restore relic"}, 500
  except ExplorationCatalogError as exc:
    logger.error("Exploration catalog unavailable during relic restore for '%s': %s", game_name, exc)
    return {"error": "Exploration catalog unavailable"}, 500

  if len(rows) != 3:
    return {"error": "Selected relic fragments not found"}, 404

  if any(row.get('subtype') != 'relic_fragment' for row in rows):
    return {"error": "Only relic fragments can be restored"}, 400

  key_order = {key: index for index, key in enumerate(unique_keys)}
  rows.sort(key=lambda row: key_order.get(row.get('key'), 0))

  non_frontier_types = {
    row['type'].lower()
    for row in rows
    if row.get('type', '').lower() != 'frontier'
  }
  if len(non_frontier_types) > 1:
    return {"error": "Fragments must share a planet type. Frontier fragments are wild."}, 400

  restored_type = next(iter(non_frontier_types), 'Frontier')

  try:
    available_relics = list_available_exploration_definitions(db_path, player_id, ['relic'])
  except (ExplorationCatalogError, DatabaseError) as exc:
    logger.error("Failed to fetch relic catalog for '%s': %s", game_name, exc)
    return {"error": "Relic catalog unavailable"}, 500

  if not available_relics:
    return {"error": "No relics remaining to restore"}, 409

  relic_choice = random.choice(available_relics)

  try:
    with get_db_connection(db_path) as connection:
      cursor = connection.cursor()
      cursor.execute(
        f"DELETE FROM playerExplorationCards WHERE playerId = ? AND explorationKey IN ({placeholders})",
        (player_id, *unique_keys)
      )
      deleted_count = cursor.rowcount
      if deleted_count != len(unique_keys):
        connection.rollback()
        return {"error": "Selected relic fragments not available"}, 404

      cursor.execute(
        "INSERT INTO playerExplorationCards (playerId, explorationKey) VALUES (?, ?)",
        (player_id, relic_choice['key'])
      )
      connection.commit()
  except DatabaseError as exc:
    logger.error("Failed to restore relic for '%s': %s", game_name, exc)
    return {"error": "Unable to restore relic"}, 500

  update_game_timestamp(db_path)

  relic_definition = get_exploration_definition(db_path, relic_choice['key']) or relic_choice
  relic_definition['isExhausted'] = False

  return {
    "relic": relic_definition,
    "consumed": unique_keys,
    "fragments": rows,
    "restoredType": restored_type.capitalize()
  }, 201


def list_planet_attachments(
  game_name: str,
  player_id: str,
  games_dir: str,
  planet_keys: Optional[Sequence[str]] = None
) -> Tuple[Dict[str, Any], int]:
  """Return attachments grouped by planet for the player."""
  valid, db_path = _ensure_game_database(game_name, games_dir)
  if not valid:
    return {"error": "Game not found"}, 404

  try:
    ensure_exploration_tables(db_path)
    populate_exploration_definitions(db_path)
    attachments = list_planet_attachments_for_player(db_path, player_id, planet_keys)
  except (ExplorationCatalogError, DatabaseError) as exc:
    logger.error("Failed to load attachments for '%s': %s", game_name, exc)
    return {"error": "Unable to load attachments"}, 500

  return {"attachments": attachments}, 200


def list_action_catalog() -> Dict[str, Any]:
  """Return the base action card catalog."""
  return list_catalog_actions()


def list_exploration_catalog() -> Dict[str, Any]:
  """Return the base exploration card catalog."""
  return list_catalog_exploration()


def list_catalogs() -> Dict[str, Any]:
  """Return both action and exploration catalogs."""
  actions = list_catalog_actions()
  exploration = list_catalog_exploration()
  return {**actions, **exploration}
