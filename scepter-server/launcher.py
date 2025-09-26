"""PyInstaller-friendly entry point for the Scepter application."""
from __future__ import annotations

import multiprocessing
import os
import sys


def _prepare_environment() -> None:
    """Ensure configuration matches the packaged runtime expectations."""
    os.environ.setdefault("FLASK_ENV", "production")


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
