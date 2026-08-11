$ErrorActionPreference = "Stop"
if (-not $IsWindows) { throw "Windows EXE must be built on Windows" }
python -m pip install -r requirements-build.txt
python -m PyInstaller --clean --noconfirm YuLawWorkbench.spec
if (-not (Test-Path "dist/YuLawWorkbench.exe")) { throw "EXE was not produced" }
Get-FileHash -Algorithm SHA256 "dist/YuLawWorkbench.exe"
