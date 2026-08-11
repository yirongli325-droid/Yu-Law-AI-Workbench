from pathlib import Path
import ast, json, sys

root=Path(__file__).resolve().parents[1]
required=[root/"local_app/main.py",root/"local_app/core.py",root/"YuLawWorkbench.spec",root/"desktop/build-windows.ps1"]
if any(not path.is_file() for path in required): raise SystemExit("desktop shell files missing")
for path in (root/"local_app").glob("*.py"): ast.parse(path.read_text(encoding="utf-8"))
spec=(root/"YuLawWorkbench.spec").read_text(encoding="utf-8")
if 'name="YuLawWorkbench"' not in spec or "console=False" not in spec: raise SystemExit("invalid Windows spec")
print(json.dumps({"ok":True,"shell":"tkinter","artifact":"dist/YuLawWorkbench.exe"}))
