"""Faction catalog utilities and helpers for faction metadata."""
import json
import logging
import os
from functools import lru_cache
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

FACTION_DATA_PATH = os.path.normpath(
    os.path.join(os.path.dirname(__file__), '..', 'data', 'factions.json')
)


class FactionCatalogError(Exception):
    """Raised when faction metadata cannot be loaded."""


def _normalise_entry(entry: Dict) -> Optional[Dict]:
    """Normalise a raw faction JSON entry into the API shape."""
    if not isinstance(entry, dict):
        return None

    required_keys = {'key', 'name'}
    if not required_keys.issubset(entry):
        logger.warning("Skipping faction entry missing required keys: %s", entry)
        return None

    starting_tech = entry.get('startingTech') or []
    if not isinstance(starting_tech, list):
        starting_tech = []

    home_planet = entry.get('homePlanet') or []
    if not isinstance(home_planet, list):
        home_planet = []

    return {
        'key': entry['key'],
        'name': entry['name'],
        'startingTech': [str(value) for value in starting_tech if isinstance(value, str)],
        'homePlanet': [str(value) for value in home_planet if isinstance(value, str)],
        'referenceAsset': entry.get('faction_reference_asset'),
        'sheetFrontAsset': entry.get('faction_sheet_asset_front'),
        'sheetBackAsset': entry.get('faction_sheet_asset_back'),
        'tokenAsset': entry.get('faction_token_asset')
    }


@lru_cache(maxsize=1)
def load_faction_catalog() -> List[Dict]:
    """Load and cache the base faction catalog from disk."""
    try:
        with open(FACTION_DATA_PATH, 'r', encoding='utf-8') as handle:
            payload = json.load(handle)
    except FileNotFoundError as exc:
        logger.error("Faction catalog JSON not found at %s", FACTION_DATA_PATH)
        raise FactionCatalogError("Faction catalog is missing") from exc
    except json.JSONDecodeError as exc:
        logger.error("Failed to parse faction catalog JSON: %s", exc)
        raise FactionCatalogError("Faction catalog file is invalid") from exc

    factions = payload.get('factions', [])
    if not isinstance(factions, list):
        logger.error("Faction catalog JSON must contain a list under the 'factions' key")
        raise FactionCatalogError("Faction catalog format is invalid")

    normalised: List[Dict] = []
    for entry in factions:
        normalised_entry = _normalise_entry(entry)
        if normalised_entry:
            normalised.append(normalised_entry)

    return normalised


@lru_cache(maxsize=1)
def _catalog_index() -> Dict[str, Dict]:
    """Return a dictionary index of the faction catalog keyed by faction key."""
    index: Dict[str, Dict] = {}
    for faction in load_faction_catalog():
        index[faction['key']] = faction
    return index


def list_factions() -> List[Dict]:
    """Return the list of known faction definitions."""
    return list(load_faction_catalog())


def get_faction_definition(faction_key: str) -> Optional[Dict]:
    """Return a faction definition for the provided key."""
    if not faction_key:
        return None

    return _catalog_index().get(faction_key)


__all__ = ['FactionCatalogError', 'list_factions', 'get_faction_definition']
