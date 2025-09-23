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
from routes.games import get_game_db_path, update_game_timestamp

logger = logging.getLogger(__name__)


ActionRow = Dict[str, Any]
ExplorationRow = Dict[str, Any]


def _ensure_game_database(game_name: str, games_dir: str) -> Tuple[bool, str]:
  """Validate that a game's database exists and return its path."""
  db_path = get_game_db_path(game_name, games_dir)
  if not os.path.exists(db_path):
    logger.warning("Requested game '%s' does not exist at %s", game_name, db_path)
    return False, db_path
  return True, db_path


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
