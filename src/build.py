"""Assemble ESP32 Tour (runs on the author's machine only). Three outputs in dist/:

  ESP32_Tour/              the app as a folder (open index.html; copy the folder to move it)
  ESP32_Tour_site/         the same app for GitHub Pages: PWA files, EMPTY accounts, .nojekyll
  ESP32_Tour_single.html   everything in one file (phones, e-mail, Drive); no service worker

All outputs are plain HTML/CSS/JS with classic scripts, so they work from file:// with no server and no
network. Run:  .venv/Scripts/python.exe -I src/build.py
"""
import base64
import json
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
DIST = ROOT / "dist"
APP = DIST / "ESP32_Tour"
SITE = DIST / "ESP32_Tour_site"
SINGLE = DIST / "ESP32_Tour_single.html"
EMPTY_ACCOUNTS = 'window.ESP32TOUR_DATA={"format":1,"accounts":[],"deleted":[]};\n'

ICONS = """cpu layout-dashboard book-open workflow user users user-plus log-in log-out settings languages
key-round download upload trash-2 check x chevron-down eye eye-off shield-check copy trophy target flame
clock rotate-ccw info lock save folder-open sun moon monitor circle-alert sparkles award chart-column
play hourglass""".split()

# Load order. "../data/accounts.js" is the carried-along accounts file (never cache-busted).
SCRIPTS = ["icons.js", "course.js", "../data/accounts.js", "crypto.js", "i18n.js", "store.js", "ui.js",
           "auth.js", "dashboard.js", "app.js", "pwa.js"]
GENERATED = ("icons.js", "course.js")

FONTS = {"Inter": ("inter", [400, 500, 600, 700]), "JetBrains Mono": ("jetbrains-mono", [400, 600])}
RANGES = {
    "latin": "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD",
    "latin-ext": "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF",
}
PWA_HEAD = """<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="ESP32 Tour">
<meta name="apple-mobile-web-app-status-bar-style" content="default">"""
FONTS_LINK = '<link rel="stylesheet" href="app/fonts.css">'
STYLES_LINK = '<link rel="stylesheet" href="app/styles.css?v={{VERSION}}">'


def icons_js():
    out = {}
    for name in ICONS:
        f = SRC / "assets" / "icons" / "lucide" / f"{name}.svg"
        if not f.exists():
            sys.exit(f"missing icon: {name}")
        inner = re.search(r"<svg[^>]*>(.*)</svg>", f.read_text(encoding="utf-8"), re.S).group(1)
        out[name] = re.sub(r"\s+", " ", inner).strip()
    return "window.ESP32TOUR_ICONS=" + json.dumps(out, separators=(",", ":")) + ";\n"


def course_data():
    course = json.loads((SRC / "course.json").read_text(encoding="utf-8"))
    for tab in course["tabs"]:
        for lesson in tab.get("lessons", []):
            lesson.setdefault("subs", course["rules"]["min_sublessons"])
    course["rules"].pop("banned_words_tabs_1_2", None)          # author-only
    js = "window.ESP32TOUR_COURSE=" + json.dumps(course, ensure_ascii=False, separators=(",", ":")) + ";\n"
    return js, course


def fonts_css(inline):
    """@font-face rules; inline=True embeds the files as base64 (single-file build)."""
    css = []
    for family, (stem, weights) in FONTS.items():
        for w in weights:
            for subset, rng in RANGES.items():
                f = SRC / "assets" / "fonts" / f"{stem}-{subset}-{w}.woff2"
                if not f.exists():
                    sys.exit(f"missing font: {f.name}")
                if inline:
                    url = "data:font/woff2;base64," + base64.b64encode(f.read_bytes()).decode()
                else:
                    shutil.copy(f, APP / "fonts" / f.name)
                    url = f"../fonts/{f.name}"
                css.append(f"@font-face{{font-family:'{family}';font-style:normal;font-weight:{w};"
                           f"font-display:swap;src:url({url}) format('woff2');unicode-range:{rng}}}")
    return "\n".join(css) + "\n"


def manifest(course):
    app = course["app"]
    return json.dumps({
        "id": "./", "name": app["long_name"]["en"], "short_name": app["short_name"],
        "description": "Offline ESP32 course: C/C++, FreeRTOS, PlatformIO. English and French.",
        "start_url": "./index.html", "scope": "./", "display": "standalone", "orientation": "any",
        "background_color": "#F3F6FB", "theme_color": "#2F6FE4", "lang": "en",
        "categories": ["education"],
        "icons": [
            {"src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
            {"src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
            {"src": "icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}],
    }, indent=1, ensure_ascii=False) + "\n"


def build_folder(course, version, icons, course_js):
    for d in ("app", "fonts", "data", "docs", "licenses", "icons"):
        (APP / d).mkdir(parents=True, exist_ok=True)
    (APP / "app" / "course.js").write_text(course_js, encoding="utf-8")
    (APP / "app" / "icons.js").write_text(icons, encoding="utf-8")
    (APP / "app" / "fonts.css").write_text(fonts_css(False), encoding="utf-8")
    for name in SCRIPTS:
        if name not in GENERATED and not name.startswith("../"):
            shutil.copy(SRC / "templates" / "js" / name, APP / "app" / name)
    shutil.copy(SRC / "templates" / "styles.css", APP / "app" / "styles.css")
    for png in ("icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png"):
        if not (SRC / "assets" / "img" / png).exists():
            sys.exit(f"missing {png}: run src/tools/make_icons.py")
        shutil.copy(SRC / "assets" / "img" / png, APP / "icons" / png)
    (APP / "manifest.webmanifest").write_text(manifest(course), encoding="utf-8")

    tpl = (SRC / "templates" / "index.html").read_text(encoding="utf-8")
    tags = "\n".join('<script src="data/accounts.js"></script>' if s.startswith("../")
                     else f'<script src="app/{s}?v={version}"></script>' for s in SCRIPTS)
    html = tpl.replace("<!--SCRIPTS-->", tags).replace("<!--PWA-HEAD-->", PWA_HEAD).replace("{{VERSION}}", version)
    (APP / "index.html").write_text(html, encoding="utf-8")

    acc = APP / "data" / "accounts.js"                    # never overwrite saved accounts when rebuilding
    if not acc.exists():
        acc.write_text(EMPTY_ACCOUNTS, encoding="utf-8")
    for lic in (ROOT / "licenses").glob("*.txt"):
        shutil.copy(lic, APP / "licenses" / lic.name)

    # Service worker: pre-caches exactly the app's own files (not licences, not docs)
    files = ["./", "index.html", "manifest.webmanifest"]
    for sub in ("app", "fonts", "icons", "data"):
        files += sorted(p.relative_to(APP).as_posix() for p in (APP / sub).iterdir() if p.is_file())
    sw = (SRC / "templates" / "sw.js").read_text(encoding="utf-8")
    sw = sw.replace("{{VERSION}}", version).replace("{{FILES}}", json.dumps(files, indent=1))
    (APP / "sw.js").write_text(sw, encoding="utf-8")


def build_site(version):
    """Same app for GitHub Pages: fresh copy, accounts file forced EMPTY so nobody's accounts get published."""
    if SITE.exists():
        shutil.rmtree(SITE)
    shutil.copytree(APP, SITE, ignore=shutil.ignore_patterns("docs"))
    (SITE / "data" / "accounts.js").write_text(EMPTY_ACCOUNTS, encoding="utf-8")
    (SITE / ".nojekyll").write_text("", encoding="utf-8")


def build_single(course_js, icons, version):
    tpl = (SRC / "templates" / "index.html").read_text(encoding="utf-8")
    css = fonts_css(True) + (SRC / "templates" / "styles.css").read_text(encoding="utf-8")
    parts = ['<script>window.ESP32TOUR_SINGLE=true;</script>']
    for s in SCRIPTS:
        if s == "pwa.js":
            continue                                       # no service worker in the single file
        if s == "icons.js":
            body = icons
        elif s == "course.js":
            body = course_js
        elif s.startswith("../"):
            parts.append('<script id="accounts-data">' + EMPTY_ACCOUNTS + '</script>')
            continue
        else:
            body = (SRC / "templates" / "js" / s).read_text(encoding="utf-8")
        if "</script" in body.lower():
            sys.exit(f"{s} contains '</script': cannot be inlined")
        parts.append("<script>" + body + "</script>")
    html = (tpl.replace(FONTS_LINK, "").replace(STYLES_LINK, "<style>\n" + css + "</style>")
            .replace("<!--PWA-HEAD-->", "").replace("<!--SCRIPTS-->", "\n".join(parts))
            .replace("{{VERSION}}", version))
    SINGLE.write_text(html, encoding="utf-8")


def main():
    course_js, course = course_data()
    version = course["app"]["version"]
    icons = icons_js()
    build_folder(course, version, icons, course_js)
    build_site(version)
    build_single(course_js, icons, version)
    print(f"version {version}")
    print(f"  folder  {APP}")
    print(f"  site    {SITE}")
    print(f"  single  {SINGLE}  ({SINGLE.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
