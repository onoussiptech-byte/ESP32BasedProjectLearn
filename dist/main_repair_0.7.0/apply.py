"""Run on main: python -I dist/main_repair_0.7.0/apply.py
Replaces the files that commit "Update V0.7" saved with merge conflict markers by the tested 0.7.0 ones. No git is run."""
import shutil
import sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
if not (ROOT / "src/course.json").is_file():
    sys.exit("main is not checked out: nothing done")
for f in sorted((HERE / "files").rglob("*")):
    if f.is_file():
        rel = f.relative_to(HERE / "files")
        old = (ROOT / rel).read_text(encoding="utf-8", errors="replace")
        if "<<<<<<< " not in old and rel.name != "pwa.js":
            print("left alone (no markers):", rel)
            continue
        shutil.copyfile(f, ROOT / rel)
        print("repaired:", rel)
