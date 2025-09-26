"""Utilities for resolving runtime paths across development and bundled builds."""
from __future__ import annotations

import os
import sys
from functools import lru_cache
from pathlib import Path
from typing import Optional

_STATIC_DIR_ENV = "SCEPTER_STATIC_DIR"
_GAMES_DIR_ENV = "SCEPTER_GAMES_DIR"


def _server_root() -> Path:
    return Path(__file__).resolve().parent


@lru_cache(maxsize=1)
def repository_root() -> Path:
    """Return the project root when running from source."""
    return _server_root().parent


@lru_cache(maxsize=1)
def bundle_root() -> Optional[Path]:
    """Return the PyInstaller bundle extraction path when available."""
    bundle_path = getattr(sys, "_MEIPASS", None)
    if bundle_path:
        return Path(bundle_path)
    return None


@lru_cache(maxsize=1)
def executable_dir() -> Path:
    """Return the directory containing the running executable."""
    if bundle_root() is not None:
        return Path(sys.executable).resolve().parent
    return _server_root()


@lru_cache(maxsize=1)
def static_assets_dir() -> Optional[Path]:
    """Resolve the directory containing compiled frontend assets."""
    override = os.environ.get(_STATIC_DIR_ENV)
    if override:
        override_path = Path(override).resolve()
        if override_path.exists():
            return override_path

    bundle_dir = bundle_root()
    if bundle_dir is not None:
        candidate = (bundle_dir / "frontend").resolve()
        if candidate.exists():
            return candidate

    candidate = repository_root() / "scepter-client" / "dist"
    if candidate.exists():
        return candidate.resolve()

    return None


@lru_cache(maxsize=1)
def games_dir() -> Path:
    """Resolve the directory used for persisting game state."""
    override = os.environ.get(_GAMES_DIR_ENV)
    if override:
        return Path(override).resolve()

    if bundle_root() is not None:
        return (executable_dir() / "games").resolve()

    return (_server_root() / "games").resolve()
