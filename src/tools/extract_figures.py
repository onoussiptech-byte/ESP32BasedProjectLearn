"""Cut the figures the lessons use out of the reference PDFs (docs/) and prepare the project pictures (Images/).

The list is src/references/figures.json. Each entry names the document, its page and the box to cut (fractions of the
page: left, top, right, bottom). White borders are trimmed. The results go to src/assets/figures/<id>.webp, and the
pixel size is written back to figures.json so a page can reserve the space before the picture loads.

Author's machine only (the results are kept in the repository):
    pip install --no-deps pymupdf pillow
    python src/tools/extract_figures.py [id ...]      # all figures, or only the ones named
"""
import io
import json
import sys
from pathlib import Path

import pymupdf
from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[2]
LIST = ROOT / "src" / "references" / "figures.json"
OUT = ROOT / "src" / "assets" / "figures"
MAX_W = 1100                                            # widest a lesson column shows, at 1.5x
pymupdf.TOOLS.mupdf_display_errors(False)


def trim(im, pad=10):
    """Remove the white border."""
    im = im.convert("RGB")
    box = ImageChops.difference(im, Image.new("RGB", im.size, "white")).convert("L").point(lambda v: 255 if v > 12 else 0).getbbox()
    if not box:
        sys.exit("empty figure")
    l, t, r, b = box
    return im.crop((max(0, l - pad), max(0, t - pad), min(im.width, r + pad), min(im.height, b + pad)))


def cut(fig):
    if "image" in fig:                                  # a picture from Images/
        im = Image.open(ROOT / "Images" / fig["image"])
        w, h = im.size
        l, t, r, b = fig.get("box", [0, 0, 1, 1])
        return trim(im.crop((int(l * w), int(t * h), int(r * w), int(b * h))))
    with pymupdf.open(ROOT / "docs" / fig["file"]) as doc:
        page = doc[fig["page"] - 1]
        l, t, r, b = fig["box"]
        W, H = page.rect.width, page.rect.height
        pix = page.get_pixmap(clip=pymupdf.Rect(l * W, t * H, r * W, b * H), dpi=300)
        return trim(Image.open(io.BytesIO(pix.tobytes("png"))))


def main():
    data = json.loads(LIST.read_text(encoding="utf-8"))
    only = set(sys.argv[1:])
    OUT.mkdir(parents=True, exist_ok=True)
    total = 0
    for fid, fig in data["figures"].items():
        if only and fid not in only:
            continue
        im = cut(fig)
        if im.width > MAX_W:
            im = im.resize((MAX_W, round(im.height * MAX_W / im.width)), Image.LANCZOS)
        path = OUT / f"{fid}.webp"
        im.save(path, "WEBP", quality=86, method=6)
        fig["w"], fig["h"] = im.size
        total += path.stat().st_size
        print(f"{fid:26} {im.width:5} x {im.height:<5} {path.stat().st_size / 1024:6.0f} KB")
    LIST.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{len(only) or len(data['figures'])} figures, {total / 1024:.0f} KB")


if __name__ == "__main__":
    main()
