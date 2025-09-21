"""Technology catalog utilities and database helpers."""
import json
import logging
import os
from functools import lru_cache
from typing import Dict, List, Optional

from .database import execute_query, execute_script, get_db_connection

logger = logging.getLogger(__name__)

TECHNOLOGY_DATA_PATH = os.path.normpath(
    os.path.join(os.path.dirname(__file__), '..', 'data', 'technology.json')
)


class TechnologyCatalogError(Exception):
    """Raised when there is an issue loading or accessing technology data."""


@lru_cache(maxsize=1)
def load_technology_catalog() -> List[Dict]:
    """Load the base technology catalog from JSON for easy seeding."""
    try:
        with open(TECHNOLOGY_DATA_PATH, 'r', encoding='utf-8') as file:
            payload = json.load(file)
    except FileNotFoundError as exc:
        logger.error("Technology catalog JSON not found at %s", TECHNOLOGY_DATA_PATH)
        raise TechnologyCatalogError("Technology catalog is missing") from exc
    except json.JSONDecodeError as exc:
        logger.error("Failed to parse technology catalog JSON: %s", exc)
        raise TechnologyCatalogError("Technology catalog file is invalid") from exc

    entries = payload.get('technology', [])
    if not isinstance(entries, list):
        logger.error("Technology catalog JSON must contain a list under the 'technology' key")
        raise TechnologyCatalogError("Technology catalog format is invalid")

    normalised: List[Dict] = []
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        required_keys = {'key', 'name', 'type', 'tier', 'asset', 'faction'}
        if not required_keys.issubset(entry.keys()):
            logger.warning("Skipping technology entry missing required keys: %s", entry)
            continue

        try:
            tier = int(entry['tier'])
        except (TypeError, ValueError):
            logger.warning("Invalid tier for technology '%s'; expected integer", entry.get('key'))
            continue

        normalised.append({
            'key': entry['key'],
            'name': entry['name'],
            'type': entry['type'],
            'tier': tier,
            'faction': (entry.get('faction') or 'none').lower(),
            'asset': entry['asset']
        })

    return normalised


def ensure_technology_tables(db_path: str) -> None:
    """Ensure technology-related tables exist for the provided game database."""
    schema = '''
        CREATE TABLE IF NOT EXISTS technologyDefinitions (
            technologyKey TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            faction TEXT,
            tier INTEGER NOT NULL,
            asset TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS playerTechnologies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            playerId TEXT NOT NULL,
            technologyKey TEXT NOT NULL,
            isExhausted INTEGER NOT NULL DEFAULT 0,
            acquiredAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (technologyKey) REFERENCES technologyDefinitions (technologyKey)
        );

        CREATE UNIQUE INDEX IF NOT EXISTS idx_player_technologies_unique
            ON playerTechnologies(playerId, technologyKey);
    '''

    execute_script(db_path, schema)


def populate_technology_definitions(db_path: str) -> None:
    """Populate the technologyDefinitions table using the JSON catalog if required."""
    ensure_technology_tables(db_path)

    catalog = load_technology_catalog()
    if not catalog:
        return

    try:
        with get_db_connection(db_path) as connection:
            cursor = connection.cursor()
            existing = cursor.execute("SELECT technologyKey FROM technologyDefinitions").fetchall()
            existing_keys = {row['technologyKey'] for row in existing}

            rows_to_insert = []
            for tech in catalog:
                if tech['key'] in existing_keys:
                    continue
                rows_to_insert.append((
                    tech['key'],
                    tech['name'],
                    tech['type'],
                    tech['faction'],
                    tech['tier'],
                    tech['asset']
                ))

            if rows_to_insert:
                cursor.executemany(
                    '''INSERT INTO technologyDefinitions (
                        technologyKey,
                        name,
                        type,
                        faction,
                        tier,
                        asset
                    ) VALUES (?, ?, ?, ?, ?, ?)''',
                    rows_to_insert
                )
                connection.commit()
    except Exception as exc:
        logger.error("Failed to populate technology definitions: %s", exc)
        raise TechnologyCatalogError("Unable to populate technology catalog") from exc


def get_technology_definition(db_path: str, technology_key: str) -> Optional[Dict]:
    """Fetch a technology definition by key for a given game database."""
    ensure_technology_tables(db_path)
    populate_technology_definitions(db_path)

    definition = execute_query(
        db_path,
        """
            SELECT technologyKey AS key,
                   name,
                   type,
                   faction,
                   tier,
                   asset
            FROM technologyDefinitions
            WHERE technologyKey = ?
        """,
        (technology_key,),
        fetch_one=True
    )

    if definition:
        definition['faction'] = (definition.get('faction') or 'none').lower()
        definition['tier'] = int(definition.get('tier', 0))

    return definition


def list_technology_definitions(db_path: str) -> List[Dict]:
    """List all technology definitions for a game database."""
    ensure_technology_tables(db_path)
    populate_technology_definitions(db_path)

    rows = execute_query(
        db_path,
        """
            SELECT technologyKey AS key,
                   name,
                   type,
                   faction,
                   tier,
                   asset
            FROM technologyDefinitions
            ORDER BY type, tier, name
        """,
        fetch_all=True
    ) or []

    normalised: List[Dict] = []
    for row in rows:
        normalised.append({
            'key': row['key'],
            'name': row['name'],
            'type': row['type'],
            'faction': (row.get('faction') or 'none').lower(),
            'tier': int(row.get('tier', 0)),
            'asset': row['asset']
        })

    return normalised


def list_catalog_technology() -> Dict[str, List[Dict]]:
    """Return the base catalog of technology cards."""
    technology = load_technology_catalog()
    return {'technology': technology}
