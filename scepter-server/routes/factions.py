"""HTTP route helpers for faction catalog access."""
import logging
from typing import Dict, Tuple

from components.faction_catalog import list_factions, FactionCatalogError

logger = logging.getLogger(__name__)


def list_faction_catalog() -> Tuple[Dict, int]:
    """Return the faction catalog for client selection menus."""
    try:
        factions = list_factions()
    except FactionCatalogError as exc:
        logger.error("Failed to load faction catalog: %s", exc)
        return {"error": "Faction catalog is unavailable"}, 500

    return {"factions": factions}, 200


__all__ = ['list_faction_catalog']
