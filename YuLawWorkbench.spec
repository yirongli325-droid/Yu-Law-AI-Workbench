# -*- mode: python ; coding: utf-8 -*-
import sys

from PyInstaller.utils.hooks import collect_submodules

a = Analysis(["local_app/__main__.py"], pathex=["."], hiddenimports=collect_submodules("tkinter"))
pyz = PYZ(a.pure)
exe = EXE(pyz, a.scripts, a.binaries, a.datas, [], name="YuLawWorkbench", console=False, onefile=True)

if sys.platform == "darwin":
    app = BUNDLE(
        exe,
        name="YuLawWorkbench.app",
        bundle_identifier="com.yulaw.workbench",
        info_plist={"NSHighResolutionCapable": True},
    )
