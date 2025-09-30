"""Action card catalog utilities and database helpers."""
import json
import logging
import os
from functools import lru_cache
from typing import Dict, List, Optional

from .database import execute_query, execute_script, get_db_connection, DatabaseError

logger = logging.getLogger(__name__)

ACTION_DATA_PATH = os.path.normpath(
    os.path.join(os.path.dirname(__file__), '..', 'data', 'actions.json')
)


class ActionCatalogError(Exception):
  """Raised when there is an issue loading or accessing action card data."""


@lru_cache(maxsize=1)
def load_action_catalog() -> List[Dict]:
  """Load the base action card catalog from JSON for easy seeding."""
  try:
    with open(ACTION_DATA_PATH, 'r', encoding='utf-8') as file:
      payload = json.load(file)
  except FileNotFoundError as exc:
    logger.error("Action card catalog JSON not found at %s", ACTION_DATA_PATH)
    raise ActionCatalogError("Action card catalog is missing") from exc
  except json.JSONDecodeError as exc:
    logger.error("Failed to parse action card catalog JSON: %s", exc)
    raise ActionCatalogError("Action card catalog file is invalid") from exc

  entries = payload.get('actions', [])
  if not isinstance(entries, list):
    logger.error("Action card catalog JSON must contain a list under the 'actions' key")
    raise ActionCatalogError("Action card catalog format is invalid")

  normalised: List[Dict] = []
  for entry in entries:
    if not isinstance(entry, dict):
      continue
    required_keys = {'key', 'name', 'asset'}
    if not required_keys.issubset(entry.keys()):
      logger.warning("Skipping action card entry missing required keys: %s", entry)
      continue

    raw_type = str(entry.get('type', 'standard')).lower()
    action_type = 'legendary' if raw_type == 'legendary' else 'standard'
    back_asset = entry.get('backAsset')
    if back_asset is not None and not isinstance(back_asset, str):
      back_asset = None

    normalised.append({
      'key': entry['key'],
      'name': entry['name'],
      'asset': entry['asset'],
      'type': action_type,
      'backAsset': back_asset
    })

  return normalised


def ensure_action_tables(db_path: str) -> None:
  """Ensure action-related tables exist for the provided game database."""
  schema = '''
      CREATE TABLE IF NOT EXISTS actionDefinitions (
          actionKey TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          asset TEXT NOT NULL,
          type TEXT NOT NULL DEFAULT 'standard',
          assetBack TEXT
      );

      CREATE TABLE IF NOT EXISTS playerActions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          playerId TEXT NOT NULL,
          actionKey TEXT NOT NULL,
          isExhausted INTEGER NOT NULL DEFAULT 0,
          acquiredAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (actionKey) REFERENCES actionDefinitions (actionKey)
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_player_actions_unique
        ON playerActions(playerId, actionKey);
  '''

  execute_script(db_path, schema)

  try:
    execute_query(
      db_path,
      "ALTER TABLE actionDefinitions ADD COLUMN type TEXT NOT NULL DEFAULT 'standard'",
      fetch_all=False
    )
  except DatabaseError:
    pass

  try:
    execute_query(
      db_path,
      "ALTER TABLE actionDefinitions ADD COLUMN assetBack TEXT",
      fetch_all=False
    )
  except DatabaseError:
    pass


def populate_action_definitions(db_path: str) -> None:
  """Populate the actionDefinitions table using the JSON catalog if required."""
  ensure_action_tables(db_path)

  catalog = load_action_catalog()
  if not catalog:
    return

  try:
    with get_db_connection(db_path) as connection:
      cursor = connection.cursor()
      existing = cursor.execute("SELECT actionKey FROM actionDefinitions").fetchall()
      existing_keys = {row['actionKey'] for row in existing}

      rows_to_insert = []
      changes_made = False
      for action in catalog:
        if action['key'] in existing_keys:
          cursor.execute(
            '''UPDATE actionDefinitions
                 SET name = ?,
                     asset = ?,
                     type = ?,
                     assetBack = ?
               WHERE actionKey = ?''',
            (
              action['name'],
              action['asset'],
              action.get('type', 'standard'),
              action.get('backAsset'),
              action['key']
            )
          )
          changes_made = True
          continue
        rows_to_insert.append((
          action['key'],
          action['name'],
          action['asset'],
          action.get('type', 'standard'),
          action.get('backAsset')
        ))

      if rows_to_insert:
        cursor.executemany(
          '''INSERT INTO actionDefinitions (
              actionKey,
              name,
              asset,
              type,
              assetBack
          ) VALUES (?, ?, ?, ?, ?)''',
          rows_to_insert
        )
        changes_made = True

      if changes_made:
        connection.commit()
  except Exception as exc:
    logger.error("Failed to populate action definitions: %s", exc)
    raise ActionCatalogError("Unable to populate action card catalog") from exc


def get_action_definition(db_path: str, action_key: str) -> Optional[Dict]:
  """Fetch an action card definition by key for a given game database."""
  ensure_action_tables(db_path)
  populate_action_definitions(db_path)

  return execute_query(
    db_path,
    """
        SELECT actionKey AS key,
               name,
               asset,
               type,
               assetBack AS backAsset
        FROM actionDefinitions
        WHERE actionKey = ?
    """,
    (action_key,),
    fetch_one=True
  )


def list_action_definitions(db_path: str) -> List[Dict]:
  """List all action card definitions for a game database."""
  ensure_action_tables(db_path)
  populate_action_definitions(db_path)

  return execute_query(
    db_path,
    """
        SELECT actionKey AS key,
               name,
               asset,
               type,
               assetBack AS backAsset
        FROM actionDefinitions
        ORDER BY name
    """,
    fetch_all=True
  ) or []


def list_catalog_actions() -> Dict[str, List[Dict]]:
  """Return the base catalog of action cards."""
  actions = load_action_catalog()
  return {'actions': actions}
