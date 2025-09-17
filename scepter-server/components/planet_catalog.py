"""Planet catalog utilities and database helpers."""
import json
import logging
import os
from functools import lru_cache
from typing import Dict, List, Optional

from .database import execute_query, execute_script, get_db_connection

logger = logging.getLogger(__name__)

PLANET_DATA_PATH = os.path.normpath(
    os.path.join(os.path.dirname(__file__), '..', 'data', 'planets.json')
)


class PlanetCatalogError(Exception):
    """Raised when there is an issue loading or accessing planet data."""


@lru_cache(maxsize=1)
def load_planet_catalog() -> List[Dict]:
    """Load the base planet catalog from JSON for easy seeding."""
    try:
        with open(PLANET_DATA_PATH, 'r', encoding='utf-8') as file:
            payload = json.load(file)
    except FileNotFoundError as exc:
        logger.error("Planet catalog JSON not found at %s", PLANET_DATA_PATH)
        raise PlanetCatalogError("Planet catalog is missing") from exc
    except json.JSONDecodeError as exc:
        logger.error("Failed to parse planet catalog JSON: %s", exc)
        raise PlanetCatalogError("Planet catalog file is invalid") from exc

    planets = payload.get('planets', [])
    if not isinstance(planets, list):
        logger.error("Planet catalog JSON must contain a list under the 'planets' key")
        raise PlanetCatalogError("Planet catalog format is invalid")

    normalised: List[Dict] = []
    for entry in planets:
        if not isinstance(entry, dict):
            continue
        required_keys = {'key', 'name', 'type', 'resources', 'influence', 'legendary', 'assetFront', 'assetBack'}
        if not required_keys.issubset(entry.keys()):
            logger.warning("Skipping planet entry missing required keys: %s", entry)
            continue

        normalised.append({
            'key': entry['key'],
            'name': entry['name'],
            'type': entry['type'],
            'techSpecialty': entry.get('techSpecialty'),
            'resources': entry['resources'],
            'influence': entry['influence'],
            'legendary': bool(entry['legendary']),
            'assetFront': entry['assetFront'],
            'assetBack': entry['assetBack']
        })

    return normalised


def ensure_planet_tables(db_path: str) -> None:
    """Ensure planet-related tables exist for the provided game database."""
    schema = '''
        CREATE TABLE IF NOT EXISTS planetDefinitions (
            planetKey TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            techSpecialty TEXT,
            resources INTEGER NOT NULL,
            influence INTEGER NOT NULL,
            legendary INTEGER NOT NULL DEFAULT 0,
            assetFront TEXT NOT NULL,
            assetBack TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS playerPlanets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            playerId TEXT NOT NULL,
            planetKey TEXT NOT NULL,
            isExhausted INTEGER NOT NULL DEFAULT 0,
            acquiredAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (planetKey) REFERENCES planetDefinitions (planetKey)
        );

        CREATE UNIQUE INDEX IF NOT EXISTS idx_player_planets_unique
            ON playerPlanets(playerId, planetKey);
    '''

    execute_script(db_path, schema)


def populate_planet_definitions(db_path: str) -> None:
    """Populate the planetDefinitions table using the JSON catalog if required."""
    ensure_planet_tables(db_path)

    catalog = load_planet_catalog()
    if not catalog:
        return

    try:
        with get_db_connection(db_path) as connection:
            cursor = connection.cursor()
            existing = cursor.execute("SELECT planetKey FROM planetDefinitions").fetchall()
            existing_keys = {row['planetKey'] for row in existing}

            rows_to_insert = []
            for planet in catalog:
                if planet['key'] in existing_keys:
                    continue
                rows_to_insert.append((
                    planet['key'],
                    planet['name'],
                    planet['type'],
                    planet['techSpecialty'],
                    planet['resources'],
                    planet['influence'],
                    1 if planet['legendary'] else 0,
                    planet['assetFront'],
                    planet['assetBack']
                ))

            if rows_to_insert:
                cursor.executemany(
                    '''INSERT INTO planetDefinitions (
                        planetKey,
                        name,
                        type,
                        techSpecialty,
                        resources,
                        influence,
                        legendary,
                        assetFront,
                        assetBack
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                    rows_to_insert
                )
                connection.commit()
    except Exception as exc:
        logger.error("Failed to populate planet definitions: %s", exc)
        raise PlanetCatalogError("Unable to populate planets") from exc


def get_planet_definition(db_path: str, planet_key: str) -> Optional[Dict]:
    """Fetch a planet definition by key for a given game database."""
    ensure_planet_tables(db_path)
    populate_planet_definitions(db_path)

    return execute_query(
        db_path,
        "SELECT planetKey as key, name, type, techSpecialty, resources, influence, legendary, assetFront, assetBack FROM planetDefinitions WHERE planetKey = ?",
        (planet_key,),
        fetch_one=True
    )


def list_planet_definitions(db_path: str) -> List[Dict]:
    """List all planet definitions for a game database."""
    ensure_planet_tables(db_path)
    populate_planet_definitions(db_path)

    return execute_query(
        db_path,
        """
            SELECT planetKey as key,
                   name,
                   type,
                   techSpecialty,
                   resources,
                   influence,
                   legendary,
                   assetFront,
                   assetBack
            FROM planetDefinitions
            ORDER BY name
        """,
        fetch_all=True
    ) or []
