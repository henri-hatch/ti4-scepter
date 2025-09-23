"""Strategem catalog utilities and database helpers."""
import json
import logging
import os
from functools import lru_cache
from typing import Dict, List, Optional, Sequence

from .database import execute_query, execute_script, get_db_connection, DatabaseError

logger = logging.getLogger(__name__)

STRATEGEM_DATA_PATH = os.path.normpath(
    os.path.join(os.path.dirname(__file__), '..', 'data', 'strategems.json')
)


class StrategemCatalogError(Exception):
  """Raised when there is an issue loading or accessing strategem data."""


@lru_cache(maxsize=1)
def load_strategem_catalog() -> List[Dict]:
  """Load the base strategem catalog from JSON for easy seeding."""
  try:
    with open(STRATEGEM_DATA_PATH, 'r', encoding='utf-8') as file:
      payload = json.load(file)
  except FileNotFoundError as exc:
    logger.error("Strategem catalog JSON not found at %s", STRATEGEM_DATA_PATH)
    raise StrategemCatalogError("Strategem catalog is missing") from exc
  except json.JSONDecodeError as exc:
    logger.error("Failed to parse strategem catalog JSON: %s", exc)
    raise StrategemCatalogError("Strategem catalog file is invalid") from exc

  entries = payload.get('strategems', [])
  if not isinstance(entries, list):
    logger.error("Strategem catalog JSON must contain a list under the 'strategems' key")
    raise StrategemCatalogError("Strategem catalog format is invalid")

  normalised: List[Dict] = []
  for entry in entries:
    if not isinstance(entry, dict):
      continue
    required_keys = {'key', 'name', 'asset'}
    if not required_keys.issubset(entry.keys()):
      logger.warning("Skipping strategem entry missing required keys: %s", entry)
      continue

    normalised.append({
      'key': entry['key'],
      'name': entry['name'],
      'asset': entry['asset']
    })

  return normalised


def ensure_strategem_tables(db_path: str) -> None:
  """Ensure strategem-related tables exist for the provided game database."""
  schema = '''
      CREATE TABLE IF NOT EXISTS strategemDefinitions (
          strategemKey TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          asset TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS playerStrategems (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          playerId TEXT NOT NULL,
          strategemKey TEXT NOT NULL,
          isExhausted INTEGER NOT NULL DEFAULT 0,
          acquiredAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (strategemKey) REFERENCES strategemDefinitions (strategemKey)
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_player_strategems_unique
        ON playerStrategems(playerId, strategemKey);

      CREATE TABLE IF NOT EXISTS strategemTradeGoods (
          strategemKey TEXT PRIMARY KEY,
          tradeGoods INTEGER NOT NULL DEFAULT 0,
          FOREIGN KEY (strategemKey) REFERENCES strategemDefinitions (strategemKey)
      );
  '''

  execute_script(db_path, schema)


def populate_strategem_definitions(db_path: str) -> None:
  """Populate the strategemDefinitions table using the JSON catalog if required."""
  ensure_strategem_tables(db_path)

  catalog = load_strategem_catalog()
  if not catalog:
    return

  try:
    with get_db_connection(db_path) as connection:
      cursor = connection.cursor()
      existing = cursor.execute("SELECT strategemKey FROM strategemDefinitions").fetchall()
      existing_keys = {row['strategemKey'] for row in existing}

      rows_to_insert = []
      for strategem in catalog:
        if strategem['key'] in existing_keys:
          continue
        rows_to_insert.append((
          strategem['key'],
          strategem['name'],
          strategem['asset']
        ))

      if rows_to_insert:
        cursor.executemany(
          '''INSERT INTO strategemDefinitions (
              strategemKey,
              name,
              asset
          ) VALUES (?, ?, ?)''',
          rows_to_insert
        )

      # Ensure trade good rows exist for every strategem
      goods_existing = cursor.execute("SELECT strategemKey FROM strategemTradeGoods").fetchall()
      goods_keys = {row['strategemKey'] for row in goods_existing}

      trade_rows = []
      for strategem in catalog:
        if strategem['key'] in goods_keys:
          continue
        trade_rows.append((strategem['key'], 0))

      if trade_rows:
        cursor.executemany(
          '''INSERT INTO strategemTradeGoods (
              strategemKey,
              tradeGoods
          ) VALUES (?, ?)''',
          trade_rows
        )

      connection.commit()
  except Exception as exc:
    logger.error("Failed to populate strategem definitions: %s", exc)
    raise StrategemCatalogError("Unable to populate strategem catalog") from exc


def list_strategem_definitions(db_path: str) -> List[Dict]:
  """List all strategem definitions for a game database including trade goods."""
  ensure_strategem_tables(db_path)
  populate_strategem_definitions(db_path)

  return execute_query(
    db_path,
    """
        SELECT sd.strategemKey AS key,
               sd.name,
               sd.asset,
               COALESCE(stg.tradeGoods, 0) AS tradeGoods
        FROM strategemDefinitions sd
        LEFT JOIN strategemTradeGoods stg ON stg.strategemKey = sd.strategemKey
        ORDER BY sd.name
    """,
    fetch_all=True
  ) or []


def get_strategem_definition(db_path: str, strategem_key: str) -> Optional[Dict]:
  """Fetch a strategem definition including trade goods by key."""
  ensure_strategem_tables(db_path)
  populate_strategem_definitions(db_path)

  return execute_query(
    db_path,
    """
        SELECT sd.strategemKey AS key,
               sd.name,
               sd.asset,
               COALESCE(stg.tradeGoods, 0) AS tradeGoods
        FROM strategemDefinitions sd
        LEFT JOIN strategemTradeGoods stg ON stg.strategemKey = sd.strategemKey
        WHERE sd.strategemKey = ?
    """,
    (strategem_key,),
    fetch_one=True
  )


def list_player_strategems(db_path: str, player_id: str) -> List[Dict]:
  """Return the strategems currently assigned to a player."""
  ensure_strategem_tables(db_path)
  populate_strategem_definitions(db_path)

  return execute_query(
    db_path,
    """
        SELECT ps.strategemKey AS key,
               sd.name,
               sd.asset,
               COALESCE(ps.isExhausted, 0) AS isExhausted,
               COALESCE(stg.tradeGoods, 0) AS tradeGoods,
               ps.acquiredAt
        FROM playerStrategems ps
        JOIN strategemDefinitions sd ON sd.strategemKey = ps.strategemKey
        LEFT JOIN strategemTradeGoods stg ON stg.strategemKey = ps.strategemKey
        WHERE ps.playerId = ?
        ORDER BY sd.name
    """,
    (player_id,),
    fetch_all=True
  ) or []


def list_available_strategem_definitions(db_path: str, player_id: str) -> List[Dict]:
  """List strategems not yet assigned to the provided player."""
  ensure_strategem_tables(db_path)
  populate_strategem_definitions(db_path)

  return execute_query(
    db_path,
    """
        SELECT sd.strategemKey AS key,
               sd.name,
               sd.asset,
               COALESCE(stg.tradeGoods, 0) AS tradeGoods
        FROM strategemDefinitions sd
        LEFT JOIN strategemTradeGoods stg ON stg.strategemKey = sd.strategemKey
        WHERE sd.strategemKey NOT IN (
          SELECT strategemKey
          FROM playerStrategems
          WHERE playerId = ?
        )
        ORDER BY sd.name
    """,
    (player_id,),
    fetch_all=True
  ) or []


def add_player_strategem(db_path: str, player_id: str, strategem_key: str) -> Optional[Dict]:
  """Assign a strategem to a player's board if not already present."""
  ensure_strategem_tables(db_path)
  populate_strategem_definitions(db_path)

  if not strategem_key:
    raise StrategemCatalogError("Strategem key is required")

  definition = get_strategem_definition(db_path, strategem_key)
  if not definition:
    raise StrategemCatalogError("Strategem not found")

  try:
    existing = execute_query(
      db_path,
      "SELECT 1 FROM playerStrategems WHERE playerId = ? AND strategemKey = ?",
      (player_id, strategem_key),
      fetch_one=True
    )
  except DatabaseError as exc:
    logger.error("Failed to check strategem ownership for '%s': %s", strategem_key, exc)
    raise StrategemCatalogError("Unable to add strategem") from exc

  if existing:
    return None

  try:
    inserted = execute_query(
      db_path,
      "INSERT INTO playerStrategems (playerId, strategemKey) VALUES (?, ?)",
      (player_id, strategem_key),
      fetch_all=False
    )
  except DatabaseError as exc:
    logger.error("Failed to add strategem '%s' for player '%s': %s", strategem_key, player_id, exc)
    raise StrategemCatalogError("Unable to add strategem") from exc

  if not inserted:
    return None

  definition['isExhausted'] = False
  return definition


def update_player_strategem_state(db_path: str, player_id: str, strategem_key: str, is_exhausted: bool) -> bool:
  """Update the exhausted state of a player's strategem."""
  ensure_strategem_tables(db_path)

  try:
    updated = execute_query(
      db_path,
      "UPDATE playerStrategems SET isExhausted = ? WHERE playerId = ? AND strategemKey = ?",
      (1 if is_exhausted else 0, player_id, strategem_key),
      fetch_all=False
    )
  except DatabaseError as exc:
    logger.error("Failed to update strategem state for '%s': %s", strategem_key, exc)
    raise StrategemCatalogError("Unable to update strategem") from exc

  return bool(updated)


def remove_player_strategem(db_path: str, player_id: str, strategem_key: str) -> bool:
  """Remove a strategem from a player's board."""
  ensure_strategem_tables(db_path)

  try:
    deleted = execute_query(
      db_path,
      "DELETE FROM playerStrategems WHERE playerId = ? AND strategemKey = ?",
      (player_id, strategem_key),
      fetch_all=False
    )
  except DatabaseError as exc:
    logger.error("Failed to remove strategem '%s' for player '%s': %s", strategem_key, player_id, exc)
    raise StrategemCatalogError("Unable to remove strategem") from exc

  return bool(deleted)


def update_strategem_trade_goods(db_path: str, strategem_key: str, trade_goods: int) -> Optional[Dict]:
  """Set the trade good count for a strategem."""
  ensure_strategem_tables(db_path)
  populate_strategem_definitions(db_path)

  if trade_goods < 0:
    trade_goods = 0

  try:
    updated = execute_query(
      db_path,
      "UPDATE strategemTradeGoods SET tradeGoods = ? WHERE strategemKey = ?",
      (trade_goods, strategem_key),
      fetch_all=False
    )
  except DatabaseError as exc:
    logger.error("Failed to update trade goods for strategem '%s': %s", strategem_key, exc)
    raise StrategemCatalogError("Unable to update trade goods") from exc

  if not updated:
    return None

  return get_strategem_definition(db_path, strategem_key)


def list_strategem_catalog() -> Dict[str, Sequence[Dict]]:
  """Return the base catalog of strategems."""
  strategems = load_strategem_catalog()
  return {'strategems': strategems}
