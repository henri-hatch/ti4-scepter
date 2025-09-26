# -*- mode: python ; coding: utf-8 -*-

from pathlib import Path

from PyInstaller.building.build_main import Analysis, PYZ, EXE

block_cipher = None

project_root = Path.cwd()
server_dir = project_root / "scepter-server"
client_dist = project_root / "scepter-client" / "dist"
data_dir = server_dir / "data"


def include_directory(root: Path, prefix: str):
    entries = []
    if not root.exists():
        return entries
    for file_path in root.rglob('*'):
        if file_path.is_file():
            relative = file_path.relative_to(root)
            destination = Path(prefix)
            if relative.parent != Path('.'):
                destination = destination / relative.parent
            entries.append((str(file_path), str(destination)))
    return entries


datas = []
datas += include_directory(client_dist, "frontend")
datas += include_directory(data_dir, "data")

analysis = Analysis(
    [str(server_dir / "launcher.py")],
    pathex=[str(server_dir)],
    binaries=[],
    datas=datas,
    hiddenimports=[
        "simple_websocket",
        "engineio.async_drivers.threading",
    ],
    hookspath=[],
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(analysis.pure, analysis.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    analysis.scripts,
    analysis.binaries,
    analysis.datas,
    [],
    name="Scepter",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
