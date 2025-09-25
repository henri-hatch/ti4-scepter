"""Objective catalog utilities and database helpers."""
import json
import logging
import os
import random
from functools import lru_cache
from typing import Any, Dict, List, Optional

from .database import execute_query, execute_script, get_db_connection, DatabaseError

logger = logging.getLogger(__name__)

OBJECTIVE_DATA_PATH = os.path.normpath(
    os.path.join(os.path.dirname(__file__), '..', 'data', 'objectives.json')
)

PUBLIC_OBJECTIVE_TYPES = {'public_tier1', 'public_tier2'}
PUBLIC_STAGE_LABELS = {
  'public_tier1': 'Stage I',
  'public_tier2': 'Stage II'
}


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

      CREATE TABLE IF NOT EXISTS gamePublicObjectives (
          objectiveKey TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          slotIndex INTEGER NOT NULL,
          addedBy TEXT NULL,
          addedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (objectiveKey) REFERENCES objectiveDefinitions (objectiveKey)
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_game_public_objectives_slot
        ON gamePublicObjectives(type, slotIndex);
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
               po.completedAt,
               gpo.slotIndex
        FROM playerObjectives po
        JOIN objectiveDefinitions od ON od.objectiveKey = po.objectiveKey
        LEFT JOIN gamePublicObjectives gpo ON gpo.objectiveKey = po.objectiveKey
        WHERE po.playerId = ?
        ORDER BY CASE od.type
                   WHEN 'public_tier1' THEN 0
                   WHEN 'public_tier2' THEN 1
                   ELSE 2
                 END,
                 COALESCE(gpo.slotIndex, 999),
                 od.name
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
          AND (
            od.type NOT IN ('public_tier1', 'public_tier2')
            OR od.objectiveKey NOT IN (
              SELECT objectiveKey FROM gamePublicObjectives
            )
          )
        ORDER BY od.type, od.name
    """,
    (player_id,),
    fetch_all=True
  ) or []


def get_game_public_objective(db_path: str, objective_key: str) -> Optional[Dict]:
  """Fetch a public objective currently in play for the game."""
  ensure_objective_tables(db_path)
  populate_objective_definitions(db_path)

  return execute_query(
    db_path,
    """
        SELECT gpo.objectiveKey AS key,
               gpo.type,
               gpo.slotIndex,
               gpo.addedBy,
               gpo.addedAt,
               od.name,
               od.victoryPoints,
               od.asset
        FROM gamePublicObjectives gpo
        JOIN objectiveDefinitions od ON od.objectiveKey = gpo.objectiveKey
        WHERE gpo.objectiveKey = ?
    """,
    (objective_key,),
    fetch_one=True
  )


def list_game_public_objectives(db_path: str) -> List[Dict]:
  """Return public objectives currently in play for the game."""
  ensure_objective_tables(db_path)
  populate_objective_definitions(db_path)

  rows = execute_query(
    db_path,
    """
        SELECT gpo.objectiveKey AS key,
               gpo.type,
               gpo.slotIndex,
               gpo.addedBy,
               gpo.addedAt,
               od.name,
               od.victoryPoints,
               od.asset
        FROM gamePublicObjectives gpo
        JOIN objectiveDefinitions od ON od.objectiveKey = gpo.objectiveKey
        ORDER BY CASE gpo.type WHEN 'public_tier1' THEN 0 WHEN 'public_tier2' THEN 1 ELSE 2 END,
                 gpo.slotIndex
    """,
    fetch_all=True
  ) or []

  normalised: List[Dict] = []
  for row in rows:
    item = dict(row)
    if 'slotIndex' in item and item['slotIndex'] is not None:
      item['slotIndex'] = int(item['slotIndex'])
    if 'victoryPoints' in item and item['victoryPoints'] is not None:
      item['victoryPoints'] = int(item['victoryPoints'])
    normalised.append(item)
  return normalised


def list_public_objective_progress(db_path: str) -> List[Dict]:
  """Return public objectives along with players who have scored them."""
  objectives = list_game_public_objectives(db_path)
  if not objectives:
    return []

  keys = [entry['key'] for entry in objectives]
  placeholders = ','.join('?' for _ in keys)

  rows = execute_query(
    db_path,
    f"""
        SELECT po.objectiveKey,
               po.playerId,
               po.completedAt,
               p.name AS playerName,
               p.faction AS faction
        FROM playerObjectives po
        JOIN players p ON p.playerId = po.playerId
        WHERE po.objectiveKey IN ({placeholders})
          AND po.isCompleted = 1
    """,
    keys,
    fetch_all=True
  ) or []

  scored_map: Dict[str, List[Dict]] = {}
  for row in rows:
    entry = dict(row)
    scored_map.setdefault(entry['objectiveKey'], []).append(entry)

  for objective in objectives:
    scored = scored_map.get(objective['key'], [])
    scored.sort(key=lambda item: (item.get('playerName') or '').lower())
    objective['scoredBy'] = scored

  return objectives


def assign_public_objective_to_game(
  db_path: str,
  player_id: Optional[str],
  objective_key: str
) -> Dict:
  """Assign a public objective to the entire game, creating player rows."""
  ensure_objective_tables(db_path)
  populate_objective_definitions(db_path)

  definition = get_objective_definition(db_path, objective_key)
  if not definition:
    raise ObjectiveCatalogError("Objective not found")

  objective_type = (definition.get('type') or '').strip().lower()
  if objective_type not in PUBLIC_OBJECTIVE_TYPES:
    raise ObjectiveCatalogError("Objective is not a public objective")

  slot_index: Optional[int] = None

  try:
    with get_db_connection(db_path) as connection:
      connection.isolation_level = None
      cursor = connection.cursor()
      cursor.execute('BEGIN IMMEDIATE')

      existing = cursor.execute(
        'SELECT slotIndex FROM gamePublicObjectives WHERE objectiveKey = ?',
        (objective_key,)
      ).fetchone()
      if existing:
        cursor.execute('ROLLBACK')
        raise ObjectiveCatalogError("Objective already in play")

      used_rows = cursor.execute(
        'SELECT slotIndex FROM gamePublicObjectives WHERE type = ? ORDER BY slotIndex',
        (objective_type,)
      ).fetchall()
      used_indices = {int(row['slotIndex']) for row in used_rows if row['slotIndex'] is not None}
      for candidate in range(5):
        if candidate not in used_indices:
          slot_index = candidate
          break

      if slot_index is None:
        cursor.execute('ROLLBACK')
        stage_label = PUBLIC_STAGE_LABELS.get(objective_type, 'Stage')
        raise ObjectiveCatalogError(f"All {stage_label} Objectives are in Play")

      cursor.execute(
        'INSERT INTO gamePublicObjectives (objectiveKey, type, slotIndex, addedBy) VALUES (?, ?, ?, ?)',
        (objective_key, objective_type, slot_index, player_id)
      )

      players = cursor.execute('SELECT playerId FROM players').fetchall()
      for row in players:
        cursor.execute(
          'INSERT OR IGNORE INTO playerObjectives (playerId, objectiveKey, isCompleted) VALUES (?, ?, 0)',
          (row['playerId'], objective_key)
        )

      connection.commit()
  except DatabaseError as exc:
    logger.error(
      "Failed to assign public objective '%s' for player '%s': %s",
      objective_key,
      player_id,
      exc
    )
    raise ObjectiveCatalogError("Unable to add objective") from exc

  entry = get_game_public_objective(db_path, objective_key)
  if not entry:
    raise ObjectiveCatalogError("Objective assignment failed")

  entry['isCompleted'] = False
  return entry


def remove_public_objective_from_game(db_path: str, objective_key: str) -> Optional[Dict]:
  """Remove a public objective from the game and adjust player totals."""
  ensure_objective_tables(db_path)
  populate_objective_definitions(db_path)

  definition = get_objective_definition(db_path, objective_key)
  if not definition or (definition.get('type') or '').strip().lower() not in PUBLIC_OBJECTIVE_TYPES:
    return None

  try:
    with get_db_connection(db_path) as connection:
      connection.isolation_level = None
      cursor = connection.cursor()
      cursor.execute('BEGIN IMMEDIATE')

      public_entry = cursor.execute(
        'SELECT type, slotIndex FROM gamePublicObjectives WHERE objectiveKey = ?',
        (objective_key,)
      ).fetchone()
      if not public_entry:
        cursor.execute('ROLLBACK')
        return None

      slot_index = int(public_entry['slotIndex']) if public_entry['slotIndex'] is not None else None
      objective_type = public_entry['type']

      player_rows = cursor.execute(
        'SELECT playerId, isCompleted FROM playerObjectives WHERE objectiveKey = ?',
        (objective_key,)
      ).fetchall()

      adjusted_players: List[Dict] = []
      delta = int(definition.get('victoryPoints', 0) or 0)
      for row in player_rows:
        player_id = row['playerId']
        if bool(row.get('isCompleted', 0)) and delta:
          cursor.execute(
            """
              UPDATE players
              SET victoryPoints = CASE
                WHEN victoryPoints - ? < 0 THEN 0
                ELSE victoryPoints - ?
              END
              WHERE playerId = ?
            """,
            (delta, delta, player_id)
          )
          adjusted_players.append({'playerId': player_id})

      cursor.execute('DELETE FROM playerObjectives WHERE objectiveKey = ?', (objective_key,))
      cursor.execute('DELETE FROM gamePublicObjectives WHERE objectiveKey = ?', (objective_key,))

      connection.commit()
  except DatabaseError as exc:
    logger.error("Failed to remove public objective '%s': %s", objective_key, exc)
    raise ObjectiveCatalogError("Unable to remove objective") from exc

  return {
    'objectiveKey': objective_key,
    'type': objective_type,
    'slotIndex': slot_index,
    'adjustedPlayers': adjusted_players
  }


def draw_random_objective_for_player(
  db_path: str,
  player_id: str,
  objective_type: str
) -> Optional[Dict]:
  """Assign a random objective of the requested type to the player."""
  ensure_objective_tables(db_path)
  populate_objective_definitions(db_path)

  normalised_type = (objective_type or '').strip().lower()
  if normalised_type not in {'public_tier1', 'public_tier2', 'secret'}:
    raise ObjectiveCatalogError("Objective type is invalid")

  try:
    if normalised_type in PUBLIC_OBJECTIVE_TYPES:
      available = execute_query(
        db_path,
        """
            SELECT od.objectiveKey AS key,
                   od.name,
                   od.type,
                   od.victoryPoints,
                   od.asset
            FROM objectiveDefinitions od
            WHERE od.type = ?
              AND od.objectiveKey NOT IN (
                SELECT objectiveKey FROM gamePublicObjectives
              )
        """,
        (normalised_type,),
        fetch_all=True
      ) or []
    else:
      available = execute_query(
        db_path,
        """
            SELECT od.objectiveKey AS key,
                   od.name,
                   od.type,
                   od.victoryPoints,
                   od.asset
            FROM objectiveDefinitions od
            WHERE od.type = ?
              AND od.objectiveKey NOT IN (
                SELECT objectiveKey FROM playerObjectives WHERE playerId = ?
              )
        """,
        (normalised_type, player_id),
        fetch_all=True
      ) or []
  except DatabaseError as exc:
    logger.error("Failed to list available objectives for draw: %s", exc)
    raise ObjectiveCatalogError("Unable to draw objective") from exc

  if not available:
    return None

  choice = random.choice(available)
  if normalised_type in PUBLIC_OBJECTIVE_TYPES:
    return assign_public_objective_to_game(db_path, player_id, choice['key'])

  assigned = add_player_objective(db_path, player_id, choice['key'])
  if assigned is None:
    raise ObjectiveCatalogError("Objective already assigned")
  return assigned


def add_player_objective(db_path: str, player_id: str, objective_key: str) -> Optional[Dict]:
  """Assign an objective to a player's board if not already present."""
  ensure_objective_tables(db_path)
  populate_objective_definitions(db_path)

  if not objective_key:
    raise ObjectiveCatalogError("Objective key is required")

  definition = get_objective_definition(db_path, objective_key)
  if not definition:
    raise ObjectiveCatalogError("Objective not found")

  objective_type = (definition.get('type') or '').strip().lower()
  if objective_type in PUBLIC_OBJECTIVE_TYPES:
    if get_game_public_objective(db_path, objective_key):
      raise ObjectiveCatalogError("Objective already in play")
    entry = assign_public_objective_to_game(db_path, player_id, objective_key)
    return entry

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
  definition['slotIndex'] = None
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
        public_entry = get_game_public_objective(db_path, objective_key)
        if public_entry and public_entry.get('slotIndex') is not None:
          payload['slotIndex'] = int(public_entry['slotIndex'])
        victory_row = cursor.execute(
          "SELECT victoryPoints FROM players WHERE playerId = ?",
          (player_id,)
        ).fetchone()
        total_points = int(victory_row['victoryPoints']) if victory_row and victory_row['victoryPoints'] is not None else 0
        player_meta = execute_query(
          db_path,
          "SELECT name, faction FROM players WHERE playerId = ?",
          (player_id,),
          fetch_one=True
        ) or {}
        player_name = player_meta.get('name') or player_id
        player_faction = player_meta.get('faction') or 'none'
        return {
          'objective': payload,
          'victoryPoints': total_points,
          'playerName': player_name,
          'playerId': player_id,
          'playerFaction': player_faction
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
  public_entry = get_game_public_objective(db_path, objective_key)
  if public_entry and public_entry.get('slotIndex') is not None:
    payload['slotIndex'] = int(public_entry['slotIndex'])
  payload['isCompleted'] = is_completed
  player_meta = execute_query(
    db_path,
    "SELECT name, faction FROM players WHERE playerId = ?",
    (player_id,),
    fetch_one=True
  ) or {}
  player_name = player_meta.get('name') or player_id
  player_faction = player_meta.get('faction') or 'none'
  return {
    'objective': payload,
    'victoryPoints': total_points,
    'playerName': player_name,
    'playerId': player_id,
    'playerFaction': player_faction
  }


def remove_player_objective(db_path: str, player_id: str, objective_key: str) -> Optional[Dict[str, Any]]:
  """Remove an objective from a player's board, adjusting victory points if needed."""
  ensure_objective_tables(db_path)

  definition = get_objective_definition(db_path, objective_key)

  objective_type = (definition.get('type') or '').strip().lower() if definition else ''

  if objective_type in PUBLIC_OBJECTIVE_TYPES:
    owned = execute_query(
      db_path,
      "SELECT 1 FROM playerObjectives WHERE playerId = ? AND objectiveKey = ?",
      (player_id, objective_key),
      fetch_one=True
    )
    if not owned:
      return None

    removal = remove_public_objective_from_game(db_path, objective_key)
    if not removal:
      return None

    victory_row = execute_query(
      db_path,
      "SELECT victoryPoints FROM players WHERE playerId = ?",
      (player_id,),
      fetch_one=True
    )
    total_points = int(victory_row['victoryPoints']) if victory_row and victory_row['victoryPoints'] is not None else 0

    removal['removedFromGame'] = True
    removal['victoryPoints'] = total_points
    removal['playerId'] = player_id
    return removal

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

  return {
    'victoryPoints': total_points,
    'playerId': player_id,
    'objectiveKey': objective_key,
    'removedFromGame': False
  }
