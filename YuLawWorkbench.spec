# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_submodules

a = Analysis(["local_app/__main__.py"], pathex=["."], hiddenimports=collect_submodules("tkinter"))
pyz = PYZ(a.pure)
exe = EXE(pyz, a.scripts, a.binaries, a.datas, [], name="YuLawWorkbench", console=False, onefile=True)
