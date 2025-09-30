#!/usr/bin/env python3
"""Build distributable bundles for Scepter using PyInstaller."""
from __future__ import annotations

import argparse
import os
import platform
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Iterable, List

PROJECT_ROOT = Path(__file__).resolve().parents[2]
CLIENT_DIR = PROJECT_ROOT / "scepter-client"
CLIENT_DIST = CLIENT_DIR / "dist"
SPEC_DIR = Path(__file__).resolve().parent
DIST_ROOT = PROJECT_ROOT / "dist" / "distributables"
BUILD_ROOT = PROJECT_ROOT / "build" / "pyinstaller"

SPEC_FILES = {
    "windows": SPEC_DIR / "scepter-onefile.spec",
    "linux": SPEC_DIR / "scepter-onefile.spec",
    "macos": SPEC_DIR / "scepter-mac.spec",
}

APP_NAME_LONG = "Scepter - A Twilight Imperium 4th Edition Helper"
APP_NAME_SHORT = "Scepter"


class CommandError(RuntimeError):
    """Raised when a subprocess call fails."""


def ensure_tooling() -> None:
    for binary in ("npm", "pyinstaller"):
        if shutil.which(binary) is None:
            raise CommandError(
                f"Required executable '{binary}' was not found on PATH"
            )


def run_command(command: Iterable[str], cwd: Path, env: Optional[dict] = None) -> None:
    """Run a subprocess command and raise a helpful error when it fails."""
    process_env = os.environ.copy()
    if env:
        process_env.update(env)

    result = subprocess.run(command, cwd=str(cwd), env=process_env)
    if result.returncode != 0:
        raise CommandError(
            f"Command {' '.join(command)} failed with exit code {result.returncode}"
        )


def ensure_frontend(skip_install: bool) -> None:
    """Install dependencies when needed and build the frontend bundle."""
    if not skip_install:
        run_command(["npm", "install"], CLIENT_DIR)

    run_command(["npm", "run", "build"], CLIENT_DIR)

    if not CLIENT_DIST.exists():
        raise CommandError("Frontend build failed: dist directory was not created")


def _pyinstaller_command(target: str, spec_file: Path) -> List[str]:
    dist_dir = DIST_ROOT / target
    build_dir = BUILD_ROOT / target
    dist_dir.mkdir(parents=True, exist_ok=True)
    build_dir.mkdir(parents=True, exist_ok=True)

    return [
        "pyinstaller",
        "--noconfirm",
        "--clean",
        "--distpath",
        str(dist_dir),
        "--workpath",
        str(build_dir),
        str(spec_file),
    ]


def build_with_pyinstaller(target: str) -> Path:
    """Run PyInstaller using the spec file for the requested target."""
    spec_file = SPEC_FILES[target]
    if not spec_file.exists():
        raise FileNotFoundError(f"Missing spec file for target '{target}': {spec_file}")

    command = _pyinstaller_command(target, spec_file)
    run_command(command, PROJECT_ROOT)

    dist_dir = DIST_ROOT / target
    if target == "macos":
        bundle_path = dist_dir / f"{APP_NAME_SHORT}.app"
        if not bundle_path.exists():
            raise CommandError("PyInstaller did not produce the expected .app bundle")
        return bundle_path

    executable_name = f"{APP_NAME_SHORT}.exe" if target == "windows" else APP_NAME_SHORT
    candidate = dist_dir / executable_name
    if not candidate.exists():
        # PyInstaller defaults to the spec name when naming outputs.
        candidate = dist_dir / APP_NAME_SHORT
        if target == "windows":
            candidate = candidate.with_suffix(".exe")

    if not candidate.exists():
        raise CommandError("PyInstaller output executable was not found")

    return candidate


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=APP_NAME_LONG)
    parser.add_argument(
        "--target",
        choices=("windows", "macos", "linux"),
        default={
            "Windows": "windows",
            "Darwin": "macos",
        }.get(platform.system(), "linux"),
        help="Select the platform-specific PyInstaller configuration to use",
    )
    parser.add_argument(
        "--skip-npm-install",
        action="store_true",
        help="Skip running npm install before building the frontend",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    try:
        ensure_tooling()
        ensure_frontend(args.skip_npm_install)
        executable = build_with_pyinstaller(args.target)
        print(f"PyInstaller output: {executable}")

    except CommandError as error:
        print(error)
        sys.exit(1)


if __name__ == "__main__":
    main()
