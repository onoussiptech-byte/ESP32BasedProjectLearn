"""Download the third-party front-end assets once, so the finished app never needs the network.

Pinned npm packages are fetched as tarballs from registry.npmjs.org; only the files the app
uses are extracted into src/assets/. Licences go to licenses/. A lock file records SHA-256.

Run:  .venv/Scripts/python.exe -I src/tools/fetch_vendor.py
"""
import hashlib
import io
import json
import sys
import tarfile
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / "src" / "assets"
LICENSES = ROOT / "licenses"
LOCK = ROOT / "src" / "assets" / "vendor.lock.json"

PRISM_LANGS = ["clike", "c", "cpp", "ini", "bash", "json", "python", "powershell", "markup"]
FONT_WEIGHTS = {"inter": [400, 500, 600, 700], "jetbrains-mono": [400, 600]}
FONT_SUBSETS = ["latin", "latin-ext"]                # latin-ext covers all French accents

PACKAGES = {
    # name: (version, {member-in-tarball: destination}, licence member)
    "prismjs": ("1.29.0",
                {**{"package/components/prism-core.min.js": "vendor/prism/prism-core.min.js"},
                 **{f"package/components/prism-{l}.min.js": f"vendor/prism/prism-{l}.min.js"
                    for l in PRISM_LANGS}},
                "package/LICENSE"),
    "@fontsource/inter": ("5.1.0",
                          {f"package/files/inter-{s}-{w}-normal.woff2": f"fonts/inter-{s}-{w}.woff2"
                           for s in FONT_SUBSETS for w in FONT_WEIGHTS["inter"]},
                          "package/LICENSE"),
    "@fontsource/jetbrains-mono": ("5.1.0",
                                   {f"package/files/jetbrains-mono-{s}-{w}-normal.woff2":
                                    f"fonts/jetbrains-mono-{s}-{w}.woff2"
                                    for s in FONT_SUBSETS for w in FONT_WEIGHTS["jetbrains-mono"]},
                                   "package/LICENSE"),
    "lucide-static": ("0.460.0", {"package/icons/": "icons/lucide/"}, "package/LICENSE"),
    # PDF viewer for phones (a computer opens the PDFs in the browser itself). Loaded only when a PDF is opened.
    "pdfjs-dist": ("4.10.38",
                   {"package/legacy/build/pdf.min.mjs": "vendor/pdfjs/pdf.min.mjs",
                    "package/legacy/build/pdf.worker.min.mjs": "vendor/pdfjs/pdf.worker.min.mjs",
                    "package/standard_fonts/": "vendor/pdfjs/standard_fonts/",
                    "package/cmaps/": "vendor/pdfjs/cmaps/"},
                   "package/LICENSE"),
    # Code-drawn diagrams (pin maps, circuits, block diagrams). Loaded only by lessons that show a diagram.
    "@svgdotjs/svg.js": ("3.2.8", {"package/dist/svg.min.js": "vendor/svgjs/svg.min.js"}, "package/LICENSE.txt"),
    # Extra diagram tools, loaded only by a diagram file that asks for them (see src/diagrams/README.md):
    # maths formulas, timing waveforms, interactive graphs/curves, block diagrams written as text.
    "katex": ("0.16.11", {"package/dist/katex.min.js": "vendor/katex/katex.min.js",
                          "package/dist/katex.min.css": "vendor/katex/katex.min.css",
                          "package/dist/fonts/": "vendor/katex/fonts/"}, "package/LICENSE"),
    "wavedrom": ("3.5.0", {"package/wavedrom.min.js": "vendor/wavedrom/wavedrom.min.js",
                           "package/skins/default.js": "vendor/wavedrom/default.js"}, "package/LICENSE"),
    "jsxgraph": ("1.10.1", {"package/distrib/jsxgraphcore.js": "vendor/jsxgraph/jsxgraphcore.js",
                            "package/distrib/jsxgraph.css": "vendor/jsxgraph/jsxgraph.css"}, "package/LICENSE.MIT"),
    "mermaid": ("11.4.1", {"package/dist/mermaid.min.js": "vendor/mermaid/mermaid.min.js"}, "package/LICENSE"),
}


def tarball_url(name, version):
    base = name.split("/")[-1]
    return f"https://registry.npmjs.org/{name}/-/{base}-{version}.tgz"


def main():
    only = set(sys.argv[1:])                         # package names to (re)download; none = all
    lock = json.loads(LOCK.read_text(encoding="utf-8")) if only and LOCK.exists() else {}
    for name, (version, files, lic) in PACKAGES.items():
        if only and name not in only:
            continue
        url = tarball_url(name, version)
        data = urllib.request.urlopen(url, timeout=120).read()
        lock[name] = {"version": version, "url": url, "sha256": hashlib.sha256(data).hexdigest()}
        count = 0
        with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as tar:
            for m in tar.getmembers():
                if not m.isfile():
                    continue
                dest = None
                for src, dst in files.items():
                    if src.endswith("/") and m.name.startswith(src) and m.name.endswith((".svg", ".woff2", ".bcmap", ".ttf", ".pfb", "LICENSE", "LICENSE_FOXIT", "LICENSE_LIBERATION")):
                        dest = ASSETS / dst / m.name[len(src):]
                    elif m.name == src:
                        dest = ASSETS / dst
                if m.name == lic:
                    out = LICENSES / f"{name.replace('/', '_').lstrip('@')}-LICENSE.txt"
                    out.write_bytes(tar.extractfile(m).read())
                if dest is None:
                    continue
                dest.parent.mkdir(parents=True, exist_ok=True)
                dest.write_bytes(tar.extractfile(m).read())
                count += 1
        missing = [s for s in files if not s.endswith("/") and not (ASSETS / files[s]).exists()]
        print(f"{name}@{version}: {count} files" + (f"  MISSING {missing}" if missing else ""))
    LOCK.write_text(json.dumps(lock, indent=1), encoding="utf-8")
    print(f"wrote {LOCK}")


if __name__ == "__main__":
    main()
