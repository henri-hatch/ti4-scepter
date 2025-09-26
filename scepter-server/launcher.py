"""PyInstaller-friendly entry point for the Scepter application."""
from __future__ import annotations

import multiprocessing
import os
import sys
from pathlib import Path


def _prepare_environment() -> None:
    """Ensure configuration matches the packaged runtime expectations."""
    os.environ.setdefault("FLASK_ENV", "production")

    bundle_root = getattr(sys, "_MEIPASS", None)
    if bundle_root:
        root_path = Path(bundle_root)
        os.environ.setdefault("SCEPTER_STATIC_DIR", str(root_path / "frontend"))
        games_path = Path(sys.executable).resolve().parent / "games"
        os.environ.setdefault("SCEPTER_GAMES_DIR", str(games_path))


def run() -> int:
    """Launch the Flask/SocketIO server."""
    _prepare_environment()
    multiprocessing.freeze_support()

    from main import main as server_main

    return server_main()


def main() -> None:
    sys.exit(run())


if __name__ == "__main__":
    main()
