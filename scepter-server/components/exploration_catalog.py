"""Exploration card catalog utilities and database helpers."""
import json
import logging
import os
from functools import lru_cache
from typing import Dict, Iterable, List, Optional, Sequence

from .database import execute_query, execute_script, get_db_connection

logger = logging.getLogger(__name__)

EXPLORATION_DATA_PATH = os.path.normpath(
  os.path.join(os.path.dirname(__file__), '..', 'data', 'exploration.json')
)


class ExplorationCatalogError(Exception):
  """Raised when there is an issue loading or accessing exploration card data."""


@lru_cache(maxsize=1)
def load_exploration_catalog() -> List[Dict]:
  """Load the base exploration card catalog from JSON for easy seeding."""
  try:
    with open(EXPLORATION_DATA_PATH, 'r', encoding='utf-8') as file:
      payload = json.load(file)
  except FileNotFoundError as exc:
    logger.error("Exploration card catalog JSON not found at %s", EXPLORATION_DATA_PATH)
    raise ExplorationCatalogError("Exploration card catalog is missing") from exc
  except json.JSONDecodeError as exc:
    logger.error("Failed to parse exploration card catalog JSON: %s", exc)
    raise ExplorationCatalogError("Exploration card catalog file is invalid") from exc

  entries = payload.get('exploration', [])
  if not isinstance(entries, list):
    logger.error("Exploration card catalog JSON must contain a list under the 'exploration' key")
    raise ExplorationCatalogError("Exploration card catalog format is invalid")

  normalised: List[Dict] = []
  for entry in entries:
    if not isinstance(entry, dict):
      continue

    required_keys = {'key', 'name', 'type', 'subtype', 'asset'}
    if not required_keys.issubset(entry.keys()):
      logger.warning("Skipping exploration entry missing required keys: %s", entry)
      continue

    normalised.append({
      'key': entry['key'],
      'name': entry['name'],
      'type': entry['type'],
      'subtype': entry['subtype'],
      'asset': entry['asset']
    })

  return normalised


def ensure_exploration_tables(db_path: str) -> None:
  """Ensure exploration-related tables exist for the provided game database."""
  schema = '''
      CREATE TABLE IF NOT EXISTS explorationDefinitions (
          explorationKey TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          subtype TEXT NOT NULL,
          asset TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS playerExplorationCards (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          playerId TEXT NOT NULL,
          explorationKey TEXT NOT NULL,
          isExhausted INTEGER NOT NULL DEFAULT 0,
          acquiredAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (explorationKey) REFERENCES explorationDefinitions (explorationKey)
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_player_exploration_unique
        ON playerExplorationCards(playerId, explorationKey);

      CREATE TABLE IF NOT EXISTS planetAttachments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          playerId TEXT NOT NULL,
          planetKey TEXT NOT NULL,
          explorationKey TEXT NOT NULL,
          attachedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (explorationKey) REFERENCES explorationDefinitions (explorationKey)
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_planet_attachments_unique
        ON planetAttachments(playerId, planetKey, explorationKey);
  '''

  execute_script(db_path, schema)


def populate_exploration_definitions(db_path: str) -> None:
  """Populate the explorationDefinitions table using the JSON catalog if required."""
  ensure_exploration_tables(db_path)

  catalog = load_exploration_catalog()
  if not catalog:
    return

  try:
    with get_db_connection(db_path) as connection:
      cursor = connection.cursor()
      existing = cursor.execute("SELECT explorationKey FROM explorationDefinitions").fetchall()
      existing_keys = {row['explorationKey'] for row in existing}

      rows_to_insert = []
      for entry in catalog:
        if entry['key'] in existing_keys:
          continue
        rows_to_insert.append((
          entry['key'],
          entry['name'],
          entry['type'],
          entry['subtype'],
          entry['asset']
        ))

      if rows_to_insert:
        cursor.executemany(
          '''INSERT OR IGNORE INTO explorationDefinitions (
              explorationKey,
              name,
              type,
              subtype,
              asset
          ) VALUES (?, ?, ?, ?, ?)''',
          rows_to_insert
        )
        connection.commit()
  except Exception as exc:
    logger.error("Failed to populate exploration definitions: %s", exc)
    raise ExplorationCatalogError("Unable to populate exploration card catalog") from exc


def get_exploration_definition(db_path: str, exploration_key: str) -> Optional[Dict]:
  """Fetch an exploration card definition by key for a given game database."""
  ensure_exploration_tables(db_path)
  populate_exploration_definitions(db_path)

  return execute_query(
    db_path,
    """
        SELECT explorationKey AS key,
               name,
               type,
               subtype,
               asset
        FROM explorationDefinitions
        WHERE explorationKey = ?
    """,
    (exploration_key,),
    fetch_one=True
  )


def list_exploration_definitions(db_path: str) -> List[Dict]:
  """List all exploration card definitions for a game database."""
  ensure_exploration_tables(db_path)
  populate_exploration_definitions(db_path)

  return execute_query(
    db_path,
    """
        SELECT explorationKey AS key,
               name,
               type,
               subtype,
               asset
        FROM explorationDefinitions
        ORDER BY type, subtype, name
    """,
    fetch_all=True
  ) or []


def list_catalog_exploration() -> Dict[str, List[Dict]]:
  """Return the base catalog of exploration cards."""
  exploration = load_exploration_catalog()
  return {'exploration': exploration}


def list_player_exploration_cards(db_path: str, player_id: str) -> List[Dict]:
  """Return the exploration cards held by a player (non-attachment subtypes)."""
  ensure_exploration_tables(db_path)
  populate_exploration_definitions(db_path)

  rows = execute_query(
    db_path,
    """
        SELECT pec.explorationKey AS key,
               ed.name,
               ed.type,
               ed.subtype,
               ed.asset,
               pec.isExhausted,
               pec.acquiredAt
        FROM playerExplorationCards pec
        JOIN explorationDefinitions ed ON ed.explorationKey = pec.explorationKey
        WHERE pec.playerId = ?
        ORDER BY ed.subtype, ed.type, ed.name
    """,
    (player_id,),
    fetch_all=True
  ) or []

  normalised: List[Dict] = []
  for row in rows:
    item = dict(row)
    item['isExhausted'] = bool(row.get('isExhausted', 0))
    normalised.append(item)
  return normalised


def list_planet_attachments_for_player(
  db_path: str,
  player_id: str,
  planet_keys: Optional[Sequence[str]] = None
) -> Dict[str, List[Dict]]:
  """Return exploration attachments grouped by planet key for the player."""
  ensure_exploration_tables(db_path)
  populate_exploration_definitions(db_path)

  params: List = [player_id]
  filter_clause = ''
  if planet_keys:
    placeholders = ','.join('?' for _ in planet_keys)
    filter_clause = f" AND pa.planetKey IN ({placeholders})"
    params.extend(list(planet_keys))

  rows = execute_query(
    db_path,
    f"""
        SELECT pa.id,
               pa.planetKey,
               ed.explorationKey AS key,
               ed.name,
               ed.type,
               ed.subtype,
               ed.asset,
               pa.attachedAt
        FROM planetAttachments pa
        JOIN explorationDefinitions ed ON ed.explorationKey = pa.explorationKey
        WHERE pa.playerId = ?{filter_clause}
        ORDER BY pa.attachedAt
    """,
    tuple(params),
    fetch_all=True
  ) or []

  grouped: Dict[str, List[Dict]] = {}
  for row in rows:
    planet_key = row['planetKey']
    grouped.setdefault(planet_key, [])
    grouped[planet_key].append({
      'id': row['id'],
      'key': row['key'],
      'name': row['name'],
      'type': row['type'],
      'subtype': row['subtype'],
      'asset': row['asset'],
      'attachedAt': row['attachedAt']
    })

  return grouped


def add_player_exploration_card(db_path: str, player_id: str, exploration_key: str) -> Optional[Dict]:
  """Assign an exploration card (non-attachment) to the player."""
  ensure_exploration_tables(db_path)
  populate_exploration_definitions(db_path)

  definition = get_exploration_definition(db_path, exploration_key)
  if not definition:
    return None

  if definition['subtype'] == 'attach':
    logger.warning("Attempted to add attachment exploration card '%s' to inventory", exploration_key)
    raise ExplorationCatalogError("Attachments must be assigned to a planet")

  existing = execute_query(
    db_path,
    "SELECT 1 FROM playerExplorationCards WHERE playerId = ? AND explorationKey = ?",
    (player_id, exploration_key),
    fetch_one=True
  )
  if existing:
    logger.debug("Player '%s' already owns exploration card '%s'", player_id, exploration_key)
    return None

  execute_query(
    db_path,
    "INSERT INTO playerExplorationCards (playerId, explorationKey) VALUES (?, ?)",
    (player_id, exploration_key),
    fetch_all=False
  )

  definition['isExhausted'] = False
  return definition


def update_player_exploration_state(
  db_path: str,
  player_id: str,
  exploration_key: str,
  is_exhausted: bool
) -> bool:
  """Update the exhausted state of an exploration card in the player's inventory."""
  ensure_exploration_tables(db_path)

  updated = execute_query(
    db_path,
    "UPDATE playerExplorationCards SET isExhausted = ? WHERE playerId = ? AND explorationKey = ?",
    (1 if is_exhausted else 0, player_id, exploration_key),
    fetch_all=False
  )
  return bool(updated)


def remove_player_exploration_card(db_path: str, player_id: str, exploration_key: str) -> bool:
  """Remove an exploration card from the player's inventory."""
  ensure_exploration_tables(db_path)

  deleted = execute_query(
    db_path,
    "DELETE FROM playerExplorationCards WHERE playerId = ? AND explorationKey = ?",
    (player_id, exploration_key),
    fetch_all=False
  )
  return bool(deleted)


def add_planet_attachment(
  db_path: str,
  player_id: str,
  planet_key: str,
  exploration_key: str
) -> Optional[Dict]:
  """Attach an exploration card to a planet."""
  ensure_exploration_tables(db_path)
  populate_exploration_definitions(db_path)

  definition = get_exploration_definition(db_path, exploration_key)
  if not definition:
    return None
  if definition['subtype'] != 'attach':
    logger.warning("Attempted to attach non-attachment exploration card '%s'", exploration_key)
    raise ExplorationCatalogError("Only attachments can be assigned to planets")

  existing = execute_query(
    db_path,
    "SELECT 1 FROM planetAttachments WHERE playerId = ? AND planetKey = ? AND explorationKey = ?",
    (player_id, planet_key, exploration_key),
    fetch_one=True
  )
  if existing:
    logger.debug(
      "Player '%s' already has attachment '%s' on planet '%s'",
      player_id,
      exploration_key,
      planet_key
    )
    return None

  execute_query(
    db_path,
    "INSERT INTO planetAttachments (playerId, planetKey, explorationKey) VALUES (?, ?, ?)",
    (player_id, planet_key, exploration_key),
    fetch_all=False
  )

  row = execute_query(
    db_path,
    """
        SELECT pa.id,
               pa.planetKey,
               ed.explorationKey AS key,
               ed.name,
               ed.type,
               ed.subtype,
               ed.asset,
               pa.attachedAt
        FROM planetAttachments pa
        JOIN explorationDefinitions ed ON ed.explorationKey = pa.explorationKey
        WHERE pa.playerId = ? AND pa.planetKey = ? AND pa.explorationKey = ?
    """,
    (player_id, planet_key, exploration_key),
    fetch_one=True
  )

  return row


def remove_planet_attachment(
  db_path: str,
  player_id: str,
  planet_key: str,
  exploration_key: str
) -> bool:
  """Detach an exploration card from a planet."""
  ensure_exploration_tables(db_path)

  deleted = execute_query(
    db_path,
    "DELETE FROM planetAttachments WHERE playerId = ? AND planetKey = ? AND explorationKey = ?",
    (player_id, planet_key, exploration_key),
    fetch_all=False
  )
  return bool(deleted)


def list_available_exploration_definitions(
  db_path: str,
  player_id: str,
  subtypes: Iterable[str],
  exclude_planet_key: Optional[str] = None
) -> List[Dict]:
  """Return exploration definitions filtered by subtype and player ownership."""
  ensure_exploration_tables(db_path)
  populate_exploration_definitions(db_path)

  subtype_list = list(subtypes)
  if not subtype_list:
    return []

  placeholders = ','.join('?' for _ in subtype_list)
  params: List = subtype_list + [player_id]

  rows = execute_query(
    db_path,
    f"""
        SELECT ed.explorationKey AS key,
               ed.name,
               ed.type,
               ed.subtype,
               ed.asset
        FROM explorationDefinitions ed
        WHERE ed.subtype IN ({placeholders})
          AND ed.explorationKey NOT IN (
            SELECT explorationKey FROM playerExplorationCards WHERE playerId = ?
          )
    """,
    tuple(params),
    fetch_all=True
  ) or []

  # Optionally exclude attachments already on a planet if requested
  if exclude_planet_key:
    attached = execute_query(
      db_path,
      "SELECT explorationKey FROM planetAttachments WHERE playerId = ? AND planetKey = ?",
      (player_id, exclude_planet_key),
      fetch_all=True
    ) or []
    attached_keys = {row['explorationKey'] for row in attached}
    rows = [row for row in rows if row['key'] not in attached_keys]

  return rows
