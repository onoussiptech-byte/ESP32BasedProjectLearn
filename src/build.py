"""Assemble ESP32 Tour (runs on the author's machine only). Outputs in dist/:

  ESP32_Tour/              the app as a folder for the PC (open index.html; copy the folder to move it). Lessons
                           are in content/ (one script per lesson, loaded when opened)
  ESP32_Tour_single.html   everything in one file (e-mail, Drive); no service worker

The phone/PWA version is NOT built into a folder here. With --publish it is assembled straight onto the GitHub
Pages branch (gh-appages): the same app files, an EMPTY accounts file and .nojekyll, committed and pushed.

All outputs are plain HTML/CSS/JS with classic scripts, so they work from file:// with no server and no network.

  python -I src/build.py                       build the PC folder and the single file
  python -I src/build.py --publish             ... and publish the PWA files to gh-appages (commit + push)
  python -I src/build.py --publish --no-push   ... commit on gh-appages only, push later yourself
  python -I src/build.py --publish --message "text"   use your own commit message
  python -I src/build.py --pwa-into FOLDER     ... and write the phone files into FOLDER, no git at all (you commit)
"""
import argparse
import base64
import json
import re
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from urllib.parse import quote, unquote

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
DIST = ROOT / "dist"
APP = DIST / "ESP32_Tour"
SINGLE = DIST / "ESP32_Tour_single.html"
PAGES_BRANCH = "gh-appages"                               # the branch GitHub Pages serves
# only the app's own files go to the phones: anything else sitting in the folder (docs, a saved copy...) stays out
PAGES_KEEP = ("app", "content", "data", "diagrams", "figures", "fonts", "icons", "licenses", "pdfjs", "index.html", "manifest.webmanifest", "sw.js")
EMPTY_ACCOUNTS = 'window.ESP32TOUR_DATA={"format":1,"accounts":[],"deleted":[]};\n'

ICONS = """cpu layout-dashboard book-open workflow user users user-plus log-in log-out settings languages
key-round download upload trash-2 check x chevron-down eye eye-off shield-check copy trophy target flame
clock rotate-ccw info lock save folder-open sun moon monitor circle-alert sparkles award chart-column
play hourglass arrow-left arrow-right chevron-right chevron-left menu list corner-up-left link-2
external-link lightbulb triangle-alert flag refresh-cw circle-check circle-x layers graduation-cap
file-text list-checks construction rocket book-marked panel-left circle-help
house fish user-cog arrow-left-right boxes blocks recycle sprout droplets droplet thermometer waves ruler wind
flask-conical zoom-in zoom-out plug zap""".split()

DASH_FIGURES = ("aquaponics-cycle",)                      # pictures shown outside the lessons (the lessons name their own)

# Load order. "../data/accounts.js" is the carried-along accounts file (never cache-busted).
SCRIPTS = ["icons.js", "prism.js", "course.js", "../data/accounts.js", "crypto.js", "i18n.js", "store.js", "ui.js",
           "auth.js", "dashboard.js", "quiz.js", "pdfview.js", "diagrams.js", "lessons.js", "overview.js", "app.js", "pwa.js"]
GENERATED = ("icons.js", "prism.js", "course.js")
PRISM_FILES = ["core", "clike", "markup", "c", "cpp", "bash", "ini", "json", "powershell", "python"]  # order matters (cpp needs c)

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


def used_figures(contents):
    """Pictures the app shows: those of the lessons and of the Dashboard."""
    names = set(DASH_FIGURES)
    for d in contents.values():
        for p in d["pages"]:
            for b in p["blocks"]:
                if b["type"] == "figure":
                    names.add(b["name"])
                elif b["type"] == "gallery":
                    names.update(it["name"] for it in b["items"] if it.get("name"))
    return sorted(names)


def cited_docs(contents):
    """The documents the lessons and their pictures link to: the phones carry these (the PC build carries all of them)."""
    urls = []
    for d in contents.values():
        for p in d["pages"]:
            urls += [s["url"] for s in p["sources"] if s.get("local")]
            for b in p["blocks"]:
                if b["type"] == "refs":
                    urls += [s["url"] for s in b["items"]]
                elif b["type"] == "gallery":
                    urls += [it["ref"]["url"] for it in b["items"] if it.get("ref")]
    figs = json.loads((SRC / "references" / "figures.json").read_text(encoding="utf-8"))["figures"]
    names = {unquote(u.split("#")[0])[len("docs/"):] for u in urls}
    names |= {figs[n]["file"] for n in used_figures(contents) if figs[n].get("doc")}
    return sorted(names)


LIGHT_OVER = 2_000_000                                     # phones get a light copy of documents larger than this
LIGHT_DPI, LIGHT_JPEG = 130, 70                            # its kept pages become pictures: readable, and much smaller
_LIGHT = {}


def doc_pages(contents, name):
    """The PDF pages of one document that the lessons (and their pictures) link to."""
    pages = set()
    for d in contents.values():
        for p in d["pages"]:
            refs = [s for s in p["sources"] if s.get("local")]
            for b in p["blocks"]:
                refs += b["items"] if b["type"] == "refs" else [it["ref"] for it in b.get("items", []) if b["type"] == "gallery" and it.get("ref")]
            pages |= {s["page"] for s in refs if unquote(s["url"].split("#")[0]) == "docs/" + name}
    figs = json.loads((SRC / "references" / "figures.json").read_text(encoding="utf-8"))["figures"]
    pages |= {figs[n]["page"] for n in used_figures(contents) if figs[n].get("file") == name}
    return pages


def phone_doc(contents, name):
    """The file a phone gets for docs/<name>. A large document becomes a light copy: the same number of pages, so every
    link still opens the right page, but only the cited pages (and the page after each) keep their content, as pictures
    at LIGHT_DPI (heavy vector drawings and fonts would otherwise keep most of the size)."""
    src = ROOT / "docs" / name
    if src.stat().st_size <= LIGHT_OVER:
        return src
    if name not in _LIGHT:
        import pymupdf                                         # pip install pymupdf (see requirements-dev.txt)
        keep = {n for p in doc_pages(contents, name) for n in (p, p + 1)}
        out = Path(tempfile.mkdtemp(prefix="esp32tour-light-")) / name
        with pymupdf.open(src) as doc, pymupdf.open() as light:
            for i in range(len(doc)):
                if i + 1 in keep:
                    page = doc[i]
                    pg = light.new_page(width=page.rect.width, height=page.rect.height)
                    pix = page.get_pixmap(dpi=LIGHT_DPI)
                    pg.insert_image(pg.rect, stream=pix.tobytes("jpg", jpg_quality=LIGHT_JPEG))
                else:
                    pg = light.new_page(width=doc[i].rect.width, height=doc[i].rect.height)
                    pg.insert_textbox(pymupdf.Rect(60, 80, pg.rect.width - 60, 300), (
                        f"Page {i + 1}: not in the phone copy of this document. Open the full document on a computer.\n\n"
                        f"Page {i + 1} : absente de la copie pour téléphone. Ouvrez le document complet sur un ordinateur."), fontsize=11)
            light.set_metadata({})                       # no date: the same input always gives the same file
            light.save(out, garbage=4, deflate=True, no_new_id=True)
        _LIGHT[name] = out
    return _LIGHT[name]


def pdfjs_files():
    root = SRC / "assets" / "vendor" / "pdfjs"
    return sorted(p.relative_to(root).as_posix() for p in root.rglob("*") if p.is_file())


def used_diagrams(contents):
    """The diagram files (src/diagrams/<name>.js) the lessons and their quiz questions show."""
    names = {b["name"] for d in contents.values() for p in d["pages"] for b in p["blocks"] if b["type"] == "diagram"}
    names |= {q["diagram"]["name"] for d in contents.values() for q in d.get("quiz", {}).get("questions", []) if q.get("diagram")}
    return sorted(names)


# Extra diagram tools (src/assets/vendor/<tool>/): files copied to app/lib/<tool>/ when a diagram file says
#   ESP32TOUR_DIAGRAMS['name'].uses = ['katex', 'wavedrom', 'jsxgraph', 'mermaid'];
DG_LIBS = {
    "katex": (["katex.min.js"], ["katex.min.css"]),
    "wavedrom": (["default.js", "wavedrom.min.js"], []),
    "jsxgraph": (["jsxgraphcore.js"], ["jsxgraph.css"]),
    "mermaid": (["mermaid.min.js"], []),
}


def used_libs(contents):
    found = set()
    for n in used_diagrams(contents):
        m = re.search(r"\.uses\s*=\s*\[([^\]]*)\]", (SRC / "diagrams" / f"{n}.js").read_text(encoding="utf-8"))
        if m:
            for tool in re.findall(r"['\"]([a-z]+)['\"]", m.group(1)):
                if tool not in DG_LIBS:
                    sys.exit(f"src/diagrams/{n}.js uses an unknown tool: {tool}")
                found.add(tool)
    return sorted(found)


def lib_files(tool):
    """(source, path under app/lib/) of one tool; KaTeX keeps only its woff2 fonts (every browser here reads woff2)."""
    root = SRC / "assets" / "vendor" / tool
    js, css = DG_LIBS[tool]
    out = [(root / f, f"{tool}/{f}") for f in js + css]
    if tool == "katex":
        out += [(f, f"katex/fonts/{f.name}") for f in sorted((root / "fonts").glob("*.woff2"))]
    return out


def katex_css_inline():
    """KaTeX CSS with its woff2 fonts as data: URLs, for the single file."""
    root = SRC / "assets" / "vendor" / "katex"
    css = (root / "katex.min.css").read_text(encoding="utf-8")

    def font(m):
        f = root / "fonts" / m.group(1)
        return "url(data:font/woff2;base64," + base64.b64encode(f.read_bytes()).decode() + ") format(\"woff2\")"
    css = re.sub(r"url\(fonts/([\w-]+\.woff2)\) format\(\"woff2\"\)", font, css)
    return re.sub(r",url\(fonts/[\w-]+\.(woff|ttf)\) format\(\"(woff|truetype)\"\)", "", css)


def icons_js():
    out = {}
    for name in ICONS:
        f = SRC / "assets" / "icons" / "lucide" / f"{name}.svg"
        if not f.exists():
            sys.exit(f"missing icon: {name}")
        inner = re.search(r"<svg[^>]*>(.*)</svg>", f.read_text(encoding="utf-8"), re.S).group(1)
        out[name] = re.sub(r"\s+", " ", inner).strip()
    return "window.ESP32TOUR_ICONS=" + json.dumps(out, separators=(",", ":")) + ";\n"


def prism_js():
    """Prism core + the languages the lessons use, in one file. Manual mode: the app highlights on demand."""
    out = ["window.Prism=window.Prism||{};window.Prism.manual=true;"]
    for name in PRISM_FILES:
        f = SRC / "assets" / "vendor" / "prism" / f"prism-{name}.min.js"
        if not f.exists():
            sys.exit(f"missing Prism file: {f.name}")
        out.append(f.read_text(encoding="utf-8").rstrip())
    return "\n".join(out) + "\n"


def js_json(obj):
    """JSON for a classic <script>: '<' is escaped so nothing can ever close an inline script block."""
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")


def course_data(contents):
    course = json.loads((SRC / "course.json").read_text(encoding="utf-8"))
    for tab in course["tabs"]:
        for lesson in tab.get("lessons", []):
            if "sub_titles" in lesson:                          # [["en","fr"], ...] -> [{en, fr}, ...]
                lesson["sub_titles"] = [{"en": en, "fr": fr} for en, fr in lesson["sub_titles"]]
                lesson["subs"] = len(lesson["sub_titles"])
            lesson.setdefault("subs", course["rules"]["min_sublessons"])
    course["rules"].pop("banned_words_tabs_1_2", None)          # author-only
    course["available"] = sorted(contents)                      # ids that have lesson content (t1.l01.s01 ...)
    figs = json.loads((SRC / "references" / "figures.json").read_text(encoding="utf-8"))["figures"]
    course["figures"] = {}
    for n in used_figures(contents):
        f = course["figures"][n] = {k: figs[n][k] for k in ("alt", "w", "h")}
        if figs[n].get("doc"):                                   # a picture taken from a document: link to its page
            f.update(doc=figs[n]["doc"], page=figs[n]["page"], url=f"docs/{quote(figs[n]['file'])}#page={figs[n]['page']}")
    docs, viewer = cited_docs(contents), pdfjs_files()            # what a phone stores for reading documents offline
    course["store"] = ["docs/" + quote(n) for n in docs] + ["pdfjs/" + n for n in viewer]
    course["storeSize"] = {**{"docs/" + quote(n): phone_doc(contents, n).stat().st_size for n in docs},   # a changed copy is fetched again
                           **{"pdfjs/" + n: (SRC / "assets" / "vendor" / "pdfjs" / n).stat().st_size for n in viewer}}
    course["storeBytes"] = (sum(phone_doc(contents, n).stat().st_size for n in docs)
                            + sum((SRC / "assets" / "vendor" / "pdfjs" / n).stat().st_size for n in viewer))
    js = "window.ESP32TOUR_COURSE=" + js_json(course) + ";\n"
    return js, course


def content_js(cid, data):
    return ('window.ESP32TOUR_CONTENT=window.ESP32TOUR_CONTENT||{};'
            f'window.ESP32TOUR_CONTENT["{cid}"]=' + js_json(data) + ";\n")


def figures_js(contents):
    """The pictures as data, for the single file only (the folder build has them in figures/)."""
    data = {n: "data:image/webp;base64," + base64.b64encode((SRC / "assets" / "figures" / f"{n}.webp").read_bytes()).decode()
            for n in used_figures(contents)}
    return "window.ESP32TOUR_FIGURES=" + json.dumps(data, separators=(",", ":")) + ";\n"


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


def build_folder(course, version, icons, course_js, prism, contents):
    for d in ("app", "fonts", "data", "docs", "licenses", "icons", "content", "figures", "diagrams"):
        (APP / d).mkdir(parents=True, exist_ok=True)
    for old in (APP / "content").glob("*.js"):                    # drop content that no longer exists
        old.unlink()
    for old in (APP / "figures").glob("*.webp"):                  # and pictures no longer used
        if old.stem not in used_figures(contents):
            old.unlink()
    for n in used_figures(contents):
        shutil.copyfile(SRC / "assets" / "figures" / f"{n}.webp", APP / "figures" / f"{n}.webp")
    for old in (APP / "diagrams").glob("*.js"):                   # diagrams drawn with code (SVG.js), used by the lessons
        old.unlink()
    for n in used_diagrams(contents):
        shutil.copyfile(SRC / "diagrams" / f"{n}.js", APP / "diagrams" / f"{n}.js")
    shutil.copyfile(SRC / "assets" / "vendor" / "svgjs" / "svg.min.js", APP / "app" / "svg.min.js")
    if (APP / "app" / "lib").exists():                            # extra diagram tools: only those a diagram asks for
        remove_tree(APP / "app" / "lib")
    for tool in used_libs(contents):
        for src, rel in lib_files(tool):
            (APP / "app" / "lib" / rel).parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(src, APP / "app" / "lib" / rel)
    for cid, data in contents.items():
        (APP / "content" / f"{cid}.js").write_text(content_js(cid, data), encoding="utf-8")
    (APP / "app" / "course.js").write_text(course_js, encoding="utf-8")
    (APP / "app" / "icons.js").write_text(icons, encoding="utf-8")
    (APP / "app" / "prism.js").write_text(prism, encoding="utf-8")
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

    if (APP / "pdfjs").exists():
        remove_tree(APP / "pdfjs")
    copy_plain(SRC / "assets" / "vendor" / "pdfjs", APP / "pdfjs")

    # The reference documents (PDF) travel with the PC build: lesson links open their exact page with no internet
    refs = json.loads((SRC / "references" / "index.json").read_text(encoding="utf-8"))
    for ref in refs.values():
        src, dst = ROOT / "docs" / ref["file"], APP / "docs" / ref["file"]
        if not src.exists():
            sys.exit(f"missing document: {src}")
        if not dst.exists() or dst.stat().st_size != src.stat().st_size:
            shutil.copyfile(src, dst)

    # Service worker: pre-caches exactly the app's own files (not licences, not docs)
    files = ["./", "index.html", "manifest.webmanifest"]
    for sub in ("app", "content", "diagrams", "figures", "fonts", "icons", "data"):
        files += sorted(p.relative_to(APP).as_posix() for p in (APP / sub).iterdir() if p.is_file())
    if (APP / "app" / "lib").exists():
        files += sorted(p.relative_to(APP).as_posix() for p in (APP / "app" / "lib").rglob("*") if p.is_file())
    sw = (SRC / "templates" / "sw.js").read_text(encoding="utf-8")
    sw = sw.replace("{{VERSION}}", version).replace("{{FILES}}", json.dumps(files, indent=1))
    (APP / "sw.js").write_text(sw, encoding="utf-8")


def copy_plain(src, dst):
    """Copy a file or folder WITHOUT its attributes. (copytree also copies a folder's Windows read-only flag, and
    Windows then refuses to delete the copy.)"""
    if src.is_dir():
        dst.mkdir(parents=True, exist_ok=True)
        for child in sorted(src.iterdir()):
            copy_plain(child, dst / child.name)
    else:
        shutil.copyfile(src, dst)


def remove_tree(path):
    """Delete a folder even when Windows marked parts of it read-only."""
    def clear_flag_and_retry(func, p, _exc):
        import os
        import stat
        os.chmod(p, stat.S_IWRITE)
        func(p)
    shutil.rmtree(path, onerror=clear_flag_and_retry)


def fill_pwa(dest, contents):
    """Write the phone/PWA version into dest: the app's own files (PAGES_KEEP), the documents the lessons link to,
    an EMPTY accounts file and .nojekyll. Anything else in dest (such as a .git folder) is left alone."""
    for name in PAGES_KEEP:
        src, target = APP / name, dest / name
        if not src.exists():
            sys.exit(f"missing {src}: the folder build must run first")
        if target.is_dir():
            remove_tree(target)
        elif target.exists():
            target.unlink()
        copy_plain(src, target)
    if (dest / "docs").exists():
        remove_tree(dest / "docs")
    (dest / "docs").mkdir()
    for n in cited_docs(contents):
        shutil.copyfile(phone_doc(contents, n), dest / "docs" / n)
    (dest / "data" / "accounts.js").write_text(EMPTY_ACCOUNTS, encoding="utf-8")   # never publish anyone's accounts
    (dest / ".nojekyll").write_text("", encoding="utf-8")


def export_pwa(dest, contents):
    """--pwa-into: put the phone files into a folder you name (normally the gh-appages checkout). No git is run:
    you commit and push yourself. Refuses a folder that holds the source (src/), so it can never overwrite main."""
    dest = Path(dest).resolve()
    if not dest.is_dir():
        sys.exit(f"{dest} is not a folder")
    if dest == APP.resolve() or (dest / "src").exists():
        sys.exit(f"{dest} holds the source or the PC build: pick the folder where the {PAGES_BRANCH} branch is checked out")
    fill_pwa(dest, contents)
    n = sum(1 for p in dest.rglob("*") if p.is_file() and ".git" not in p.relative_to(dest).parts)
    print(f"  pwa     {dest}  ({n} files, empty accounts file; no git command was run)")


def git(*args, cwd=ROOT):
    r = subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True, encoding="utf-8")
    if r.returncode:
        sys.exit(f"git {' '.join(args)} failed:\n{(r.stderr or r.stdout).strip()}")
    return r.stdout.strip()


def publish(version, message, push, contents):
    """Put the PWA files on the gh-appages branch. The branch is checked out into a temporary work folder (so the
    project folder and main are never touched), its content is replaced by the app's own files with an EMPTY
    accounts file, then committed and pushed. Nothing is written to dist/ for the phones."""
    if not git("branch", "--list", PAGES_BRANCH):
        sys.exit(f"branch {PAGES_BRANCH} does not exist here: create it first (git branch {PAGES_BRANCH} origin/{PAGES_BRANCH})")
    if push:
        git("fetch", "origin", PAGES_BRANCH)
    tmp = Path(tempfile.mkdtemp(prefix="esp32tour-pages-"))
    work = tmp / "pages"
    git("worktree", "add", str(work), PAGES_BRANCH)
    try:
        if push:
            behind = int(git("rev-list", "--count", f"{PAGES_BRANCH}..origin/{PAGES_BRANCH}", cwd=work))
            ahead = int(git("rev-list", "--count", f"origin/{PAGES_BRANCH}..{PAGES_BRANCH}", cwd=work))
            if behind and ahead:
                sys.exit(f"{PAGES_BRANCH} and origin/{PAGES_BRANCH} have diverged: sort that out with git first")
            if behind:
                git("merge", "--ff-only", f"origin/{PAGES_BRANCH}", cwd=work)
        for p in work.iterdir():                                 # the branch holds the app files and nothing else
            if p.name != ".git":
                shutil.rmtree(p) if p.is_dir() else p.unlink()
        fill_pwa(work, contents)
        git("add", "-A", cwd=work)
        if not git("status", "--porcelain", cwd=work):
            print(f"  publish {PAGES_BRANCH}: already up to date, nothing to commit")
            return
        n = len(git("diff", "--cached", "--name-only", cwd=work).splitlines())
        git("commit", "-m", message, cwd=work)
        sha = git("rev-parse", "--short", "HEAD", cwd=work)
        if push:
            r = subprocess.run(["git", "push", "origin", PAGES_BRANCH], cwd=work, capture_output=True, text=True, encoding="utf-8")
            if r.returncode:
                sys.exit(f"The commit {sha} is on the local {PAGES_BRANCH} branch, but git could not push it:\n"
                         f"{r.stderr.strip()}\nPush it yourself from a terminal signed in with an account that may write to "
                         f"the repository:  git push origin {PAGES_BRANCH}")
        print(f"  publish {PAGES_BRANCH}: {sha} ({n} file(s) changed){' pushed to origin' if push else ' (not pushed)'}")
    finally:
        for i in range(6):                                       # Windows may hold the folder for a moment
            subprocess.run(["git", "worktree", "remove", "--force", str(work)], cwd=ROOT, capture_output=True)
            try:
                if tmp.exists():
                    remove_tree(tmp)
            except OSError:
                pass
            if not tmp.exists():
                break
            time.sleep(0.5)
        subprocess.run(["git", "worktree", "prune"], cwd=ROOT, capture_output=True)
        if tmp.exists():
            print(f"warning: could not remove the temporary folder {tmp}; delete it by hand")


def build_single(course_js, icons, prism, contents, version):
    tpl = (SRC / "templates" / "index.html").read_text(encoding="utf-8")
    css = fonts_css(True) + (SRC / "templates" / "styles.css").read_text(encoding="utf-8")
    parts = ['<script>window.ESP32TOUR_SINGLE=true;</script>']
    for s in SCRIPTS:
        if s in ("pwa.js", "pdfview.js"):
            continue                                       # no service worker and no documents in the single file
        if s == "icons.js":
            body = icons
        elif s == "prism.js":                              # "<!--" then "<script" would confuse the HTML parser inline
            body = prism.replace("<!--", "\\x3C!--").replace("<script", "\\x3Cscript")
        elif s == "course.js":
            dg = used_diagrams(contents)                    # diagrams and SVG.js travel inside the file when a lesson uses one
            if dg:
                parts.append("<script>" + (SRC / "assets" / "vendor" / "svgjs" / "svg.min.js").read_text(encoding="utf-8") + "</script>")
            for tool in used_libs(contents):            # the extra tools travel inside the file too
                for src, rel in lib_files(tool):
                    if rel.endswith(".js"):
                        parts.append("<script>" + src.read_text(encoding="utf-8").replace("</script", "<\\/script") + "</script>")
                    elif rel.endswith(".css"):
                        parts.append("<style>" + (katex_css_inline() if tool == "katex" else src.read_text(encoding="utf-8")) + "</style>")
            body = course_js + figures_js(contents) + "".join((SRC / "diagrams" / f"{n}.js").read_text(encoding="utf-8") for n in dg) + "".join(content_js(cid, d) for cid, d in contents.items())   # lessons travel inside the file
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
    ap = argparse.ArgumentParser(description="Build ESP32 Tour; optionally publish the PWA files to the gh-appages branch.")
    ap.add_argument("--publish", action="store_true", help=f"also update the {PAGES_BRANCH} branch with the PWA files")
    ap.add_argument("--no-push", action="store_true", help="with --publish: commit on the branch but do not push")
    ap.add_argument("--message", help="with --publish: the commit message")
    ap.add_argument("--pwa-into", metavar="FOLDER", help="write the phone/PWA files into FOLDER (no git is run)")
    args = ap.parse_args()
    sys.dont_write_bytecode = True                              # keep src/tools free of __pycache__
    sys.path.insert(0, str(SRC / "tools"))
    import validate_content
    contents, errors, warnings = validate_content.validate()    # the build stops on any content error
    for w in warnings:
        print("warning:", w)
    if errors:
        for e in errors:
            print("ERROR:", e)
        sys.exit(f"{len(errors)} content error(s): fix them and build again")
    course_js, course = course_data(contents)
    version = course["app"]["version"]
    icons, prism = icons_js(), prism_js()
    build_folder(course, version, icons, course_js, prism, contents)
    build_single(course_js, icons, prism, contents, version)
    for n in validate_content.NOTES:
        if n != "pypdf":
            print("note:", n)
    print(f"version {version}  ({len(contents)} lesson content file(s))")
    print(f"  folder  {APP}")
    print(f"  single  {SINGLE}  ({SINGLE.stat().st_size // 1024} KB)")
    if args.pwa_into:
        export_pwa(args.pwa_into, contents)
    if args.publish:
        publish(version, args.message or f"Publish ESP32 Tour v{version} (PWA build)", push=not args.no_push, contents=contents)


if __name__ == "__main__":
    main()
