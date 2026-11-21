"""Draw the ESP32 Tour app icons (PNG) with the standard library only (no Pillow).

Output in src/assets/img/: icon-192.png, icon-512.png, icon-maskable-512.png (full bleed, chip inside the
safe zone), apple-touch-icon.png (180, full bleed, no transparency: iOS rounds it itself).
Run:  .venv/Scripts/python.exe -I src/tools/make_icons.py
"""
import math
import struct
import zlib
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "assets" / "img"
BLUE_TOP = (91, 146, 238)      # --blue-400
BLUE_BOT = (36, 89, 197)       # --blue-600


def sd_rect(px, py, cx, cy, hw, hh, r):
    """Signed distance to a rounded rectangle (negative inside)."""
    qx, qy = abs(px - cx) - (hw - r), abs(py - cy) - (hh - r)
    return math.hypot(max(qx, 0.0), max(qy, 0.0)) + min(max(qx, qy), 0.0) - r


def chip_shapes(scale):
    """Chip glyph in unit coordinates, scaled about the centre (scale<1 keeps it in the maskable safe zone)."""
    s = scale
    shapes = []                                          # (kind, cx, cy, hw, hh, r, stroke)
    shapes.append(("ring", .5, .5, .20 * s, .20 * s, .045 * s, .040 * s))
    shapes.append(("fill", .5, .5, .075 * s, .075 * s, .015 * s, 0))
    for off in (-.09, 0.0, .09):                         # three pins per side
        o = off * s
        for sign in (-1, 1):
            d = sign * (.20 + .045) * s
            shapes.append(("fill", .5 + o, .5 + d, .016 * s, .045 * s, .008 * s, 0))   # top / bottom
            shapes.append(("fill", .5 + d, .5 + o, .045 * s, .016 * s, .008 * s, 0))   # left / right
    return shapes


def render(size, rounded, chip_scale):
    px_unit = 1.0 / size
    shapes = chip_shapes(chip_scale)
    rows = []
    for y in range(size):
        v = (y + .5) * px_unit
        row = bytearray()
        for x in range(size):
            u = (x + .5) * px_unit
            t = (u + v) / 2                                 # diagonal gradient
            base = [BLUE_TOP[i] + (BLUE_BOT[i] - BLUE_TOP[i]) * t for i in range(3)]
            alpha = 1.0
            if rounded:                                     # rounded-square silhouette with soft edge
                d = sd_rect(u, v, .5, .5, .5, .5, .22)
                alpha = min(1.0, max(0.0, .5 - d / px_unit))
            cov = 0.0
            for kind, cx, cy, hw, hh, r, st in shapes:
                d = sd_rect(u, v, cx, cy, hw, hh, r)
                if kind == "ring":
                    d = abs(d) - st / 2
                cov = max(cov, min(1.0, max(0.0, .5 - d / px_unit)))
            col = [base[i] + (255 - base[i]) * cov for i in range(3)]
            row += bytes((int(col[0]), int(col[1]), int(col[2]), int(alpha * 255)))
        rows.append(bytes(row))
    return rows


def write_png(path, size, rows):
    raw = b"".join(b"\x00" + r for r in rows)               # filter type 0 per scanline

    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)) \
        + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    path.write_bytes(png)
    print(f"{path.name}: {size}x{size}, {len(png)} bytes")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    write_png(OUT / "icon-192.png", 192, render(192, True, 1.0))
    write_png(OUT / "icon-512.png", 512, render(512, True, 1.0))
    write_png(OUT / "icon-maskable-512.png", 512, render(512, False, .72))   # inside the 80% safe zone
    write_png(OUT / "apple-touch-icon.png", 180, render(180, False, .9))


if __name__ == "__main__":
    main()
