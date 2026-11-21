"""Build references/index.json from the outlines (bookmarks) of the Espressif PDFs.

Each entry gives the section title, its depth, and the 1-based PDF page, so lessons can
cite "ch. 14, §14.2, p. 386" and link to <pdf>#page=386.

Run on the author's machine only:  .venv/Scripts/python.exe src/tools/pdf_index.py
"""
import json
import sys
from pathlib import Path

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[2]          # ESP32BasedProjectLearn/
DOC_DIR = ROOT.parent                                # ESP32/ holds the PDFs
OUT = ROOT / "src" / "references" / "index.json"

# key -> (file name, short title, official online URL)
DOCS = {
    "datasheet": ("esp32_datasheet_en.pdf", "ESP32 Series Datasheet",
                  "https://www.espressif.com/sites/default/files/documentation/esp32_datasheet_en.pdf"),
    "trm": ("esp32_technical_reference_manual_en.pdf", "ESP32 Technical Reference Manual",
            "https://www.espressif.com/sites/default/files/documentation/esp32_technical_reference_manual_en.pdf"),
    "idf": ("esp-idf-en-v5.3-esp32.pdf", "ESP-IDF Programming Guide v5.3 (ESP32)",
            "https://docs.espressif.com/projects/esp-idf/en/v5.3/esp32/esp-idf-en-v5.3-esp32.pdf"),
}


def walk(reader, items, depth, out):
    """Flatten the nested outline list into [{title, depth, page}]."""
    for it in items:
        if isinstance(it, list):                     # children of the previous item
            walk(reader, it, depth + 1, out)
            continue
        try:
            page = reader.get_destination_page_number(it) + 1
        except Exception:                            # broken bookmark: skip it
            continue
        out.append({"title": str(it.title).strip(), "depth": depth, "page": page})


def main():
    index = {}
    for key, (name, title, url) in DOCS.items():
        path = DOC_DIR / name
        if not path.exists():
            print(f"missing: {path}", file=sys.stderr)
            continue
        reader = PdfReader(str(path))
        sections = []
        walk(reader, reader.outline, 0, sections)
        index[key] = {"file": name, "title": title, "url": url,
                      "pages": len(reader.pages), "sections": sections}
        print(f"{key:9} {len(reader.pages):5} pages  {len(sections):5} sections")
    OUT.write_text(json.dumps(index, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
