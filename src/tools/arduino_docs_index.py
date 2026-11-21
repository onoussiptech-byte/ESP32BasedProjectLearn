"""Index the ESP32 Arduino Core documentation (reStructuredText sources) by page and section.

Source: a sparse clone of github.com/espressif/arduino-esp32 (docs/en) in
src/references/arduino-core/repo. Output: src/references/arduino_index.json with, for every
page, its title, online URL and section titles with their Sphinx anchors, so lessons can link to
https://docs.espressif.com/projects/arduino-esp32/en/latest/api/ledc.html#ledcattach

Refresh the sources:  git -C src/references/arduino-core/repo pull --depth 1
Run:                  .venv/Scripts/python.exe -I src/tools/arduino_docs_index.py
"""
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REPO = ROOT / "src" / "references" / "arduino-core" / "repo"
DOCS = REPO / "docs" / "en"
OUT = ROOT / "src" / "references" / "arduino_index.json"
BASE_URL = "https://docs.espressif.com/projects/arduino-esp32/en/latest/"

ADORN = set("=-~*^#+\"'`")


def anchor(title):
    """Sphinx-style id: lowercase, non-alphanumerics collapsed to single hyphens."""
    return re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")


def sections(text):
    """Find titles underlined (optionally overlined) with a repeated punctuation character."""
    lines = text.splitlines()
    order, found = [], []
    for i in range(1, len(lines)):
        under, title = lines[i].rstrip(), lines[i - 1].rstrip()
        if (len(under) >= 3 and len(set(under)) == 1 and under[0] in ADORN
                and title and not set(title) <= ADORN and len(under) >= len(title.strip()) - 1):
            ch = under[0] + ("o" if i >= 2 and lines[i - 2].rstrip() == under else "")
            if ch not in order:
                order.append(ch)
            t = title.strip().replace("``", "")
            found.append({"title": t, "level": order.index(ch), "anchor": anchor(t)})
    return found


def main():
    commit = subprocess.run(["git", "-C", str(REPO), "log", "-1", "--format=%H %cs"],
                            capture_output=True, text=True).stdout.strip()
    pages = []
    for rst in sorted(DOCS.rglob("*.rst")):
        rel = rst.relative_to(DOCS).with_suffix("").as_posix()
        secs = sections(rst.read_text(encoding="utf-8", errors="replace"))
        pages.append({"path": rel, "url": BASE_URL + rel + ".html",
                      "title": secs[0]["title"] if secs else rel, "sections": secs[1:]})
    OUT.write_text(json.dumps({"source": "espressif/arduino-esp32 docs/en", "commit": commit,
                               "base_url": BASE_URL, "pages": pages},
                              ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(pages)} pages, {sum(len(p['sections']) for p in pages)} sections -> {OUT}")


if __name__ == "__main__":
    main()
