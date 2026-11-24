"""Copy the AquaNode firmware into src/firmware/, the copy the lessons take their code from.

The Wi-Fi password is replaced by a placeholder, because the lessons are published. A manifest records the line count
and SHA-256 of every file, so the build can tell when the lessons and the firmware no longer match.

    python -I src/tools/sync_firmware.py "<path to AquaNode_Firmware>"           # copy
    python -I src/tools/sync_firmware.py "<path to AquaNode_Firmware>" --check   # only report differences
"""
import hashlib
import json
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEST = ROOT / "src" / "firmware"
PLACEHOLDER = "change-me-2026"


def collect(src):
    files = {}
    for p in [src / "platformio.ini", *sorted((src / "include").rglob("*.h")), *sorted((src / "src").rglob("*"))]:
        if p.is_file() and p.suffix in (".ini", ".h", ".cpp"):
            text = p.read_text(encoding="utf-8").replace("\r\n", "\n")
            files[p.relative_to(src).as_posix()] = re.sub(r'(AP_PASSWORD\s*=\s*)"[^"]*"', rf'\1"{PLACEHOLDER}"', text)
    return files


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) != 1 or not (Path(args[0]) / "platformio.ini").is_file():
        sys.exit(__doc__)
    files = collect(Path(args[0]))
    if f'"{PLACEHOLDER}"' not in files["include/config.h"]:
        sys.exit("the Wi-Fi password line was not found in config.h: nothing copied")
    manifest = {n: {"lines": t.count("\n") + (not t.endswith("\n")), "sha256": hashlib.sha256(t.encode("utf-8")).hexdigest()}
                for n, t in files.items()}
    mf = DEST / "manifest.json"
    if "--check" in sys.argv:
        old = json.loads(mf.read_text(encoding="utf-8")) if mf.exists() else {}
        diff = sorted(n for n in set(old) | set(manifest) if old.get(n) != manifest.get(n))
        print("\n".join(f"differs: {n}" for n in diff) or "src/firmware matches the firmware")
        sys.exit(1 if diff else 0)
    for part in ("include", "src"):
        if (DEST / part).exists():
            shutil.rmtree(DEST / part)
    for n, t in files.items():
        (DEST / n).parent.mkdir(parents=True, exist_ok=True)
        (DEST / n).write_bytes(t.encode("utf-8"))
    mf.write_bytes((json.dumps(manifest, indent=1) + "\n").encode("utf-8"))
    print(f"{len(files)} files, {sum(m['lines'] for m in manifest.values())} lines copied to {DEST}")


if __name__ == "__main__":
    main()
