"""Objective catalog utilities and database helpers."""
import json
import logging
import os
from functools import lru_cache
from typing import Dict, List, Optional

from .database import execute_query, execute_script, get_db_connection, DatabaseError

logger = logging.getLogger(__name__)

OBJECTIVE_DATA_PATH = os.path.normpath(
    os.path.join(os.path.dirname(__file__), '..', 'data', 'objectives.json')
)


class ObjectiveCatalogError(Exception):
  """Raised when there is an issue loading or accessing objective data."""


@lru_cache(maxsize=1)
def load_objective_catalog() -> List[Dict]:
  """Load the base objective catalog from JSON for seeding."""
  try:
    with open(OBJECTIVE_DATA_PATH, 'r', encoding='utf-8') as file:
      payload = json.load(file)
  except FileNotFoundError as exc:
    logger.error("Objective catalog JSON not found at %s", OBJECTIVE_DATA_PATH)
    raise ObjectiveCatalogError("Objective catalog is missing") from exc
  except json.JSONDecodeError as exc:
    logger.error("Failed to parse objective catalog JSON: %s", exc)
    raise ObjectiveCatalogError("Objective catalog file is invalid") from exc

  entries = payload.get('objectives', [])
  if not isinstance(entries, list):
    logger.error("Objective catalog JSON must contain a list under the 'objectives' key")
    raise ObjectiveCatalogError("Objective catalog format is invalid")

  normalised: List[Dict] = []
  for entry in entries:
    if not isinstance(entry, dict):
      continue
    required_keys = {'key', 'name', 'type', 'victoryPoints', 'asset'}
    if not required_keys.issubset(entry.keys()):
      logger.warning("Skipping objective entry missing required keys: %s", entry)
      continue

    normalised.append({
      'key': entry['key'],
      'name': entry['name'],
      'type': entry['type'],
      'victoryPoints': int(entry['victoryPoints']),
      'asset': entry['asset']
    })

  return normalised


def ensure_objective_tables(db_path: str) -> None:
  """Ensure objective-related tables exist for the provided game database."""
  schema = '''
      CREATE TABLE IF NOT EXISTS objectiveDefinitions (
          objectiveKey TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          victoryPoints INTEGER NOT NULL,
          asset TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS playerObjectives (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          playerId TEXT NOT NULL,
          objectiveKey TEXT NOT NULL,
          isCompleted INTEGER NOT NULL DEFAULT 0,
          acquiredAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          completedAt TIMESTAMP NULL,
          FOREIGN KEY (objectiveKey) REFERENCES objectiveDefinitions (objectiveKey)
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_player_objectives_unique
        ON playerObjectives(playerId, objectiveKey);
  '''

  execute_script(db_path, schema)


def populate_objective_definitions(db_path: str) -> None:
  """Populate the objectiveDefinitions table using the JSON catalog if required."""
  ensure_objective_tables(db_path)

  catalog = load_objective_catalog()
  if not catalog:
    return

  try:
    with get_db_connection(db_path) as connection:
      cursor = connection.cursor()
      existing = cursor.execute("SELECT objectiveKey FROM objectiveDefinitions").fetchall()
      existing_keys = {row['objectiveKey'] for row in existing}

      rows_to_insert = []
      for objective in catalog:
        if objective['key'] in existing_keys:
          continue
        rows_to_insert.append((
          objective['key'],
          objective['name'],
          objective['type'],
          int(objective['victoryPoints']),
          objective['asset']
        ))

      if rows_to_insert:
        cursor.executemany(
          '''INSERT INTO objectiveDefinitions (
              objectiveKey,
              name,
              type,
              victoryPoints,
              asset
          ) VALUES (?, ?, ?, ?, ?)''',
          rows_to_insert
        )

      connection.commit()
  except Exception as exc:
    logger.error("Failed to populate objective definitions: %s", exc)
    raise ObjectiveCatalogError("Unable to populate objective catalog") from exc


def list_objective_definitions(db_path: str) -> List[Dict]:
  """List all objective definitions for a game database."""
  ensure_objective_tables(db_path)
  populate_objective_definitions(db_path)

  return execute_query(
    db_path,
    """
        SELECT objectiveKey AS key,
               name,
               type,
               victoryPoints,
               asset
        FROM objectiveDefinitions
        ORDER BY type, name
    """,
    fetch_all=True
  ) or []


def get_objective_definition(db_path: str, objective_key: str) -> Optional[Dict]:
  """Fetch a single objective definition by key."""
  ensure_objective_tables(db_path)
  populate_objective_definitions(db_path)

  return execute_query(
    db_path,
    """
        SELECT objectiveKey AS key,
               name,
               type,
               victoryPoints,
               asset
        FROM objectiveDefinitions
        WHERE objectiveKey = ?
    """,
    (objective_key,),
    fetch_one=True
  )


def list_player_objectives(db_path: str, player_id: str) -> List[Dict]:
  """Return the objectives currently assigned to a player."""
  ensure_objective_tables(db_path)
  populate_objective_definitions(db_path)

  return execute_query(
    db_path,
    """
        SELECT po.objectiveKey AS key,
               od.name,
               od.type,
               od.victoryPoints,
               od.asset,
               COALESCE(po.isCompleted, 0) AS isCompleted,
               po.acquiredAt,
               po.completedAt
        FROM playerObjectives po
        JOIN objectiveDefinitions od ON od.objectiveKey = po.objectiveKey
        WHERE po.playerId = ?
        ORDER BY od.type, od.name
    """,
    (player_id,),
    fetch_all=True
  ) or []


def list_available_objective_definitions(db_path: str, player_id: str) -> List[Dict]:
  """List objective definitions not yet assigned to the provided player."""
  ensure_objective_tables(db_path)
  populate_objective_definitions(db_path)

  return execute_query(
    db_path,
    """
        SELECT od.objectiveKey AS key,
               od.name,
               od.type,
               od.victoryPoints,
               od.asset
        FROM objectiveDefinitions od
        WHERE od.objectiveKey NOT IN (
          SELECT objectiveKey FROM playerObjectives WHERE playerId = ?
        )
        ORDER BY od.type, od.name
    """,
    (player_id,),
    fetch_all=True
  ) or []


def add_player_objective(db_path: str, player_id: str, objective_key: str) -> Optional[Dict]:
  """Assign an objective to a player's board if not already present."""
  ensure_objective_tables(db_path)
  populate_objective_definitions(db_path)

  if not objective_key:
    raise ObjectiveCatalogError("Objective key is required")

  definition = get_objective_definition(db_path, objective_key)
  if not definition:
    raise ObjectiveCatalogError("Objective not found")

  try:
    existing = execute_query(
      db_path,
      "SELECT 1 FROM playerObjectives WHERE playerId = ? AND objectiveKey = ?",
      (player_id, objective_key),
      fetch_one=True
    )
  except DatabaseError as exc:
    logger.error("Failed to check objective ownership for '%s': %s", objective_key, exc)
    raise ObjectiveCatalogError("Unable to add objective") from exc

  if existing:
    return None

  try:
    inserted = execute_query(
      db_path,
      "INSERT INTO playerObjectives (playerId, objectiveKey) VALUES (?, ?)",
      (player_id, objective_key),
      fetch_all=False
    )
  except DatabaseError as exc:
    logger.error("Failed to add objective '%s' for player '%s': %s", objective_key, player_id, exc)
    raise ObjectiveCatalogError("Unable to add objective") from exc

  if not inserted:
    return None

  definition['isCompleted'] = False
  return definition


def update_player_objective_state(
  db_path: str,
  player_id: str,
  objective_key: str,
  is_completed: bool
) -> Optional[Dict]:
  """Update the completion state of an objective and adjust victory points."""
  ensure_objective_tables(db_path)
  populate_objective_definitions(db_path)

  definition = get_objective_definition(db_path, objective_key)
  if not definition:
    raise ObjectiveCatalogError("Objective not found")

  try:
    with get_db_connection(db_path) as connection:
      connection.isolation_level = None
      cursor = connection.cursor()
      cursor.execute('BEGIN IMMEDIATE')

      owned = cursor.execute(
        "SELECT isCompleted FROM playerObjectives WHERE playerId = ? AND objectiveKey = ?",
        (player_id, objective_key)
      ).fetchone()
      if not owned:
        cursor.execute('ROLLBACK')
        return None

      previously_completed = bool(owned['isCompleted'])
      if previously_completed == is_completed:
        cursor.execute('COMMIT')
        payload = dict(definition)
        payload['isCompleted'] = previously_completed
        victory_row = cursor.execute(
          "SELECT victoryPoints FROM players WHERE playerId = ?",
          (player_id,)
        ).fetchone()
        total_points = int(victory_row['victoryPoints']) if victory_row and victory_row['victoryPoints'] is not None else 0
        return {
          'objective': payload,
          'victoryPoints': total_points
        }

      cursor.execute(
        "UPDATE playerObjectives SET isCompleted = ?, completedAt = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE NULL END WHERE playerId = ? AND objectiveKey = ?",
        (1 if is_completed else 0, 1 if is_completed else 0, player_id, objective_key)
      )

      delta = int(definition['victoryPoints'])
      adjustment = delta if is_completed else -delta
      cursor.execute(
        """
          UPDATE players
          SET victoryPoints = CASE
            WHEN victoryPoints + ? < 0 THEN 0
            ELSE victoryPoints + ?
          END
          WHERE playerId = ?
        """,
        (adjustment, adjustment, player_id)
      )

      total_row = cursor.execute(
        "SELECT victoryPoints FROM players WHERE playerId = ?",
        (player_id,)
      ).fetchone()
      total_points = int(total_row['victoryPoints']) if total_row and total_row['victoryPoints'] is not None else 0

      connection.commit()
  except DatabaseError as exc:
    logger.error("Failed to update objective '%s' for player '%s': %s", objective_key, player_id, exc)
    raise ObjectiveCatalogError("Unable to update objective") from exc

  payload = dict(definition)
  payload['isCompleted'] = is_completed
  return {
    'objective': payload,
    'victoryPoints': total_points
  }


def remove_player_objective(db_path: str, player_id: str, objective_key: str) -> Optional[int]:
  """Remove an objective from a player's board, adjusting victory points if needed."""
  ensure_objective_tables(db_path)

  definition = get_objective_definition(db_path, objective_key)

  try:
    with get_db_connection(db_path) as connection:
      connection.isolation_level = None
      cursor = connection.cursor()
      cursor.execute('BEGIN IMMEDIATE')

      owned = cursor.execute(
        "SELECT isCompleted FROM playerObjectives WHERE playerId = ? AND objectiveKey = ?",
        (player_id, objective_key)
      ).fetchone()
      if not owned:
        cursor.execute('ROLLBACK')
        return None

      was_completed = bool(owned['isCompleted'])
      cursor.execute(
        "DELETE FROM playerObjectives WHERE playerId = ? AND objectiveKey = ?",
        (player_id, objective_key)
      )

      if was_completed and definition:
        points_removed = int(definition['victoryPoints'])
        cursor.execute(
          """
            UPDATE players
            SET victoryPoints = CASE
              WHEN victoryPoints - ? < 0 THEN 0
              ELSE victoryPoints - ?
            END
            WHERE playerId = ?
          """,
          (points_removed, points_removed, player_id)
        )

      total_row = cursor.execute(
        "SELECT victoryPoints FROM players WHERE playerId = ?",
        (player_id,)
      ).fetchone()
      total_points = int(total_row['victoryPoints']) if total_row and total_row['victoryPoints'] is not None else 0

      connection.commit()
  except DatabaseError as exc:
    logger.error("Failed to remove objective '%s' for player '%s': %s", objective_key, player_id, exc)
    raise ObjectiveCatalogError("Unable to remove objective") from exc

  return total_points
