"""Validate and resolve the lesson content in src/content (runs on the author's machine; stdlib only).

Content lives in src/content/<tab>/<lesson>/<sub>.json, e.g. src/content/t1/l01/s01.json (id t1.l01.s01).
This module is used by build.py (the build stops on any error) and can be run alone:

    python -I src/tools/validate_content.py

It checks: structure, EN and FR on every text, 1-4 lesson pages, quiz size and question rules,
inline markup, chip targets, banned words, and it resolves every `sources` entry against the
reference indexes (src/references/index.json and arduino_index.json), adding page number and link.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "src"
LANGS = ("en", "fr")
BLOCKS = {"p", "h", "list", "facts", "table", "callout", "flow", "steps", "code"}
CODE_LANGS = {"c", "cpp", "bash", "ini", "json", "markup", "powershell", "python", "plain"}
CALLOUTS = {"tip", "note", "warn"}
QTYPES = {"single", "multi", "truefalse", "code_output", "fill_blank", "order"}
CHIP_RE = re.compile(r"\[\[([^\]|]+)\|([^\]]+)\]\]")
LINK_RE = re.compile(r"\[([^\]]+)\]\(([^)\s]+)\)")
TARGET_RE = re.compile(r"^(t\d)\.(l\d\d)\.(s\d\d|final)(?:/p(\d))?(?:#([a-z0-9-]+))?$")


def load_course():
    return json.loads((SRC / "course.json").read_text(encoding="utf-8"))


_ICONS = None


def build_icons():
    """The icon names build.py bundles (a flow block may only use these)."""
    global _ICONS
    if _ICONS is None:
        text = (SRC / "build.py").read_text(encoding="utf-8")
        m = re.search(r'ICONS = """(.*?)"""', text, re.S)
        _ICONS = set(m.group(1).split()) if m else set()
    return _ICONS


def load_refs():
    refs = {}
    p = SRC / "references" / "index.json"
    if p.exists():
        refs.update(json.loads(p.read_text(encoding="utf-8")))
    a = SRC / "references" / "arduino_index.json"
    if a.exists():
        refs["arduino"] = json.loads(a.read_text(encoding="utf-8"))
    return refs


class Check:
    def __init__(self):
        self.errors, self.warnings = [], []

    def err(self, where, msg):
        self.errors.append(f"{where}: {msg}")

    def warn(self, where, msg):
        self.warnings.append(f"{where}: {msg}")


def texts(obj):
    """Yield every string inside a nested structure."""
    if isinstance(obj, str):
        yield obj
    elif isinstance(obj, dict):
        for v in obj.values():
            yield from texts(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from texts(v)


def bilingual(c, where, obj, required=True):
    if not isinstance(obj, dict) or set(obj) - set(LANGS):
        c.err(where, "expected an object with only 'en' and 'fr'")
        return
    for lang in LANGS:
        v = obj.get(lang)
        if required and (not isinstance(v, str) or not v.strip()):
            c.err(where, f"missing or empty '{lang}' text")
        elif isinstance(v, str):
            markup(c, f"{where}.{lang}", v)


def plain_or_bilingual(c, where, obj):
    if isinstance(obj, str):
        if not obj.strip():
            c.err(where, "empty text")
    else:
        bilingual(c, where, obj)


def markup(c, where, s):
    if s.count("**") % 2:
        c.err(where, "unbalanced ** (bold)")
    if s.replace("**", "").count("`") % 2:
        c.err(where, "unbalanced ` (code)")
    for m in LINK_RE.finditer(CHIP_RE.sub("", s)):
        if not m.group(2).startswith("https://"):
            c.err(where, f"link must be https: {m.group(2)}")


_PDFS = {}
NOTES = []


def pdf_page_text(ref, page):
    """Text of one PDF page, or None when pypdf or the PDF is not available (the check is then skipped)."""
    try:
        from pypdf import PdfReader
    except ImportError:
        if "pypdf" not in NOTES:
            NOTES.append("pypdf")
        return None
    path = ROOT.parent / ref["file"]
    if not path.exists():
        return None
    if path not in _PDFS:
        _PDFS[path] = PdfReader(str(path))
    try:
        return _PDFS[path].pages[page - 1].extract_text()
    except (IndexError, ValueError):
        return None


def squash(s):
    return re.sub(r"[^a-z0-9]+", "", s.lower())


def resolve_source(c, where, src, refs):
    doc = src.get("doc")
    if doc in ("datasheet", "trm", "idf"):
        ref = refs.get(doc)
        if not ref:
            c.err(where, f"reference index for '{doc}' not found")
            return None
        hits = [s for s in ref["sections"] if s["title"].strip().lower() == src.get("section", "").strip().lower()]
        if "page" in src:
            hits = [s for s in hits if s["page"] == src["page"]]
        if not hits:
            c.err(where, f"section not found in {doc}: {src.get('section')!r}")
            return None
        if len(hits) > 1:
            c.err(where, f"section {src.get('section')!r} is ambiguous ({len(hits)} hits): add a 'page'")
            return None
        s = hits[0]
        page = src.get("pdf_page", s["page"])                   # "pdf_page" corrects a wrong page in the index
        text = pdf_page_text(ref, page)
        if text is not None and squash(re.sub(r"^[\d.]+\s*", "", s["title"])) not in squash(text):
            c.err(where, f"heading {s['title']!r} is not on PDF page {page} (the index says {s['page']}): "
                         f"look it up and add \"pdf_page\": N to this source")
        return {"doc": doc, "section": s["title"], "page": page, "url": f"{ref['url']}#page={page}"}
    if doc == "arduino":
        ref = refs.get("arduino")
        page = next((p for p in (ref or {}).get("pages", []) if p["path"] == src.get("page")), None)
        if not page:
            c.err(where, f"Arduino docs page not found: {src.get('page')!r}")
            return None
        sec = src.get("section")
        if sec:
            hit = next((s for s in page["sections"] if s["title"].lower() == sec.lower()), None)
            if not hit:
                c.err(where, f"Arduino docs section not found: {sec!r} in {page['path']}")
                return None
            return {"doc": doc, "section": hit["title"], "page": None, "url": page["url"] + "#" + hit["anchor"], "title": page["title"]}
        return {"doc": doc, "section": page["title"], "page": None, "url": page["url"], "title": page["title"]}
    c.err(where, f"unknown source doc {doc!r}")
    return None


def check_block(c, where, b, ids):
    t = b.get("type")
    if t not in BLOCKS:
        c.err(where, f"unknown block type {t!r}")
        return
    if t in ("p", "h"):
        bilingual(c, where + ".text", b.get("text"))
    if t == "h":
        i = b.get("id", "")
        if not re.fullmatch(r"[a-z0-9-]+", i):
            c.err(where, "heading needs an 'id' like 'my-section'")
        elif i in ids:
            c.err(where, f"duplicate section id {i!r} on this page")
        ids.add(i)
    if t == "list":
        if not b.get("items"):
            c.err(where, "empty list")
        for k, it in enumerate(b.get("items", [])):
            bilingual(c, f"{where}.items[{k}]", it)
    if t == "facts":
        items = b.get("items", [])
        if not 2 <= len(items) <= 8:
            c.err(where, "facts needs 2 to 8 items")
        for k, it in enumerate(items):
            if not isinstance(it.get("value"), str) or not it["value"].strip():
                c.err(f"{where}.items[{k}]", "missing 'value'")
            bilingual(c, f"{where}.items[{k}].label", it.get("label"))
    if t == "table":
        head, rows = b.get("head", []), b.get("rows", [])
        if not head or not rows:
            c.err(where, "table needs 'head' and 'rows'")
        for k, h in enumerate(head):
            plain_or_bilingual(c, f"{where}.head[{k}]", h)
        for r, row in enumerate(rows):
            if len(row) != len(head):
                c.err(f"{where}.rows[{r}]", f"has {len(row)} cells, header has {len(head)}")
            for k, cell in enumerate(row):
                plain_or_bilingual(c, f"{where}.rows[{r}][{k}]", cell)
    if t == "callout":
        if b.get("kind") not in CALLOUTS:
            c.err(where, f"callout kind must be one of {sorted(CALLOUTS)}")
        bilingual(c, where + ".title", b.get("title"))
        bilingual(c, where + ".text", b.get("text"))
    if t in ("flow", "steps"):
        items = b.get("items", [])
        if not 2 <= len(items) <= 6:
            c.err(where, f"{t} needs 2 to 6 items")
        for k, it in enumerate(items):
            bilingual(c, f"{where}.items[{k}].title", it.get("title"))
            bilingual(c, f"{where}.items[{k}].text", it.get("text"))
            if t == "flow" and it.get("icon") and it["icon"] not in build_icons():
                c.err(f"{where}.items[{k}]", f"icon {it['icon']!r} is not in ICONS in src/build.py (add it there)")
    if t == "code":
        if b.get("lang", "plain") not in CODE_LANGS:
            c.err(where, f"code lang must be one of {sorted(CODE_LANGS)}")
        if not isinstance(b.get("code"), str) or not b["code"].strip():
            c.err(where, "empty code")
        if b.get("caption") is not None:
            bilingual(c, where + ".caption", b["caption"])


def check_question(c, where, q, ids):
    t = q.get("type")
    qid = q.get("id", "")
    if not re.fullmatch(r"q\d+", qid) or qid in ids:
        c.err(where, f"question id {qid!r} must look like q1 and be unique")
    ids.add(qid)
    if t not in QTYPES:
        c.err(where, f"unknown question type {t!r}")
        return
    bilingual(c, where + ".prompt", q.get("prompt"))
    bilingual(c, where + ".explain", q.get("explain"))
    opts = q.get("options", [])
    if t in ("single", "multi", "code_output"):
        oid = [o.get("id") for o in opts]
        if len(set(oid)) != len(oid) or not all(oid):
            c.err(where, "option ids must be unique and non-empty")
        for k, o in enumerate(opts):
            plain_or_bilingual(c, f"{where}.options[{k}].text", o.get("text"))
        good = sum(1 for o in opts if o.get("correct"))
        if t in ("single", "code_output"):
            if len(opts) != 4:
                c.err(where, f"{t} needs exactly 4 options (has {len(opts)})")
            if good != 1:
                c.err(where, f"{t} needs exactly 1 correct option (has {good})")
        else:
            if len(opts) < 5:
                c.err(where, f"multi needs 5 or more options (has {len(opts)})")
            if not 2 <= good <= len(opts) - 1:
                c.err(where, f"multi needs between 2 and {len(opts) - 1} correct options (has {good})")
    if t == "code_output":
        code = q.get("code") or {}
        if code.get("lang", "cpp") not in CODE_LANGS or not str(code.get("text", "")).strip():
            c.err(where, "code_output needs code.lang and code.text")
    if t == "truefalse" and not isinstance(q.get("answer"), bool):
        c.err(where, "truefalse needs a boolean 'answer'")
    if t == "fill_blank":
        tpl, choices, blanks = q.get("template"), q.get("choices", []), q.get("blanks", {})
        bilingual(c, where + ".template", tpl)
        cid = [x.get("id") for x in choices]
        if len(set(cid)) != len(cid):
            c.err(where, "choice ids must be unique")
        for k, x in enumerate(choices):
            bilingual(c, f"{where}.choices[{k}].text", x.get("text"))
        if isinstance(tpl, dict):
            for lang in LANGS:
                marks = set(re.findall(r"\{(\d+)\}", tpl.get(lang, "")))
                if marks != set(blanks):
                    c.err(where, f"template '{lang}' blanks {sorted(marks)} differ from 'blanks' {sorted(blanks)}")
        if not blanks:
            c.err(where, "fill_blank needs at least one blank")
        if any(v not in cid for v in blanks.values()):
            c.err(where, "a blank points to an unknown choice")
        if len(set(blanks.values())) != len(blanks):
            c.err(where, "two blanks use the same choice: use distinct choices")
        if len(choices) < len(blanks) + 1:
            c.err(where, "fill_blank needs at least one extra (wrong) choice")
    if t == "order":
        items = q.get("items", [])
        if not 3 <= len(items) <= 6:
            c.err(where, "order needs 3 to 6 items")
        if len({x.get("id") for x in items}) != len(items):
            c.err(where, "item ids must be unique")
        for k, x in enumerate(items):
            bilingual(c, f"{where}.items[{k}].text", x.get("text"))


def banned_hits(data, words):
    hits = []
    blob = "\n".join(texts(data))
    for w in words:
        pat = re.compile(r"\b" + re.escape(w) + r"\b") if w.isupper() else re.compile(re.escape(w), re.I)
        if pat.search(blob):
            hits.append(w)
    return hits


def validate(verbose=False):
    """Return (contents, errors, warnings). contents[id] is the resolved dict ready to ship."""
    course, refs, c = load_course(), load_refs(), Check()
    rules = course["rules"]
    lessons = {}
    for tb in course["tabs"]:
        for ls in tb.get("lessons", []):
            lessons[f"{tb['id']}.{ls['id']}"] = ls
    files = sorted((SRC / "content").rglob("*.json")) if (SRC / "content").exists() else []
    contents, known = {}, set()
    for f in files:
        rel = f.relative_to(SRC / "content").with_suffix("")
        parts = rel.parts
        where = "/".join(parts)
        if len(parts) != 3 or not re.fullmatch(r"t\d", parts[0]) or not re.fullmatch(r"l\d\d", parts[1]) or not re.fullmatch(r"s\d\d|final", parts[2]):
            c.err(where, "path must look like t1/l01/s01.json (or final.json)")
            continue
        cid = ".".join(parts)
        try:
            d = json.loads(f.read_text(encoding="utf-8"))
        except ValueError as e:
            c.err(where, f"invalid JSON: {e}")
            continue
        if d.get("id") != cid:
            c.err(where, f"'id' must be {cid!r}")
        lkey = ".".join(parts[:2])
        if lkey not in lessons:
            c.err(where, f"unknown lesson {lkey}")
            continue
        if parts[2] != "final":
            n = int(parts[2][1:])
            subs = len(lessons[lkey].get("sub_titles", [])) or rules["min_sublessons"]
            if not 1 <= n <= subs:
                c.err(where, f"sub-lesson {n} is outside 1..{subs}")
        known.add(cid)
        contents[cid] = d

    for cid, d in contents.items():
        is_final = cid.endswith(".final")
        bilingual(c, cid + ".summary", d.get("summary"))
        goals = d.get("goals", [])
        if not 2 <= len(goals) <= 5:
            c.err(cid, "'goals' needs 2 to 5 entries")
        for k, gl in enumerate(goals):
            bilingual(c, f"{cid}.goals[{k}]", gl)
        pages = d.get("pages", [])
        lp = rules["lesson_pages"]
        if not lp["min"] <= len(pages) <= lp["max"]:
            c.err(cid, f"{len(pages)} lesson pages: must be {lp['min']} to {lp['max']}")
        pids = [p.get("id") for p in pages]
        if pids != [f"p{i + 1}" for i in range(len(pages))]:
            c.err(cid, f"page ids must be p1..p{len(pages)} in order (got {pids})")
        sections = {}
        for p in pages:
            pw = f"{cid}.{p.get('id')}"
            bilingual(c, pw + ".title", p.get("title"))
            if not p.get("blocks"):
                c.err(pw, "page has no blocks")
            ids = set()
            for k, b in enumerate(p.get("blocks", [])):
                check_block(c, f"{pw}.blocks[{k}]", b, ids)
            sections[p.get("id")] = ids
            resolved = []
            for k, s in enumerate(p.get("sources", [])):
                r = resolve_source(c, f"{pw}.sources[{k}]", s, refs)
                if r:
                    resolved.append(r)
            if not p.get("sources"):
                c.warn(pw, "no sources listed")
            p["sources"] = resolved
        quiz = d.get("quiz", {})
        qs = quiz.get("questions", [])
        want = rules["final_quiz" if is_final else "sub_quiz"]["questions"]
        if len(qs) != want:
            c.err(cid, f"quiz has {len(qs)} questions: must be {want}")
        qids = set()
        for k, q in enumerate(qs):
            check_question(c, f"{cid}.quiz[{k}]", q, qids)
        types = {q.get("type") for q in qs}
        need = rules["final_quiz_min_types" if is_final else "sub_quiz_min_types"]
        if len(types & QTYPES) < need:
            c.err(cid, f"quiz uses {len(types & QTYPES)} question types: needs at least {need}")
        # chips: target page and section must exist when the target lesson exists
        for s in texts(d):
            for m in CHIP_RE.finditer(s):
                tm = TARGET_RE.match(m.group(2).strip())
                if not tm:
                    c.err(cid, f"bad chip target {m.group(2)!r}")
                    continue
                tgt = f"{tm.group(1)}.{tm.group(2)}.{tm.group(3)}"
                if tgt in contents:
                    pg = "p" + (tm.group(4) or "1")
                    if pg not in contents[tgt].get("pages", []) and pg not in [x.get("id") for x in contents[tgt].get("pages", [])]:
                        c.err(cid, f"chip {m.group(2)!r}: page {pg} does not exist")
                    elif tm.group(5):
                        tp = next(x for x in contents[tgt]["pages"] if x["id"] == pg)
                        if not any(b.get("type") == "h" and b.get("id") == tm.group(5) for b in tp["blocks"]):
                            c.err(cid, f"chip {m.group(2)!r}: section {tm.group(5)!r} not found on {pg}")
                elif f"{tm.group(1)}.{tm.group(2)}" in lessons:
                    c.warn(cid, f"chip {m.group(2)!r} points to a sub-lesson without content yet")
                else:
                    c.err(cid, f"chip {m.group(2)!r} points to an unknown lesson")
        # banned words (tabs 1 and 2 are general ESP32 teaching)
        if cid.startswith(("t1.", "t2.")):
            hits = banned_hits(d, rules.get("banned_words_tabs_1_2", []))
            if hits:
                c.err(cid, f"banned words found: {hits}")
        if verbose:
            print(f"  {cid}: {len(pages)} pages, {len(qs)} questions, types {sorted(types)}")
    return contents, c.errors, c.warnings


def main():
    contents, errors, warnings = validate(verbose=True)
    for w in warnings:
        print("warning:", w)
    if "pypdf" in NOTES:
        print("note: pypdf is not installed here, so cited page numbers were not checked against the PDFs "
              "(pip install pypdf to enable the check)")
    for e in errors:
        print("ERROR:", e)
    print(f"{len(contents)} content file(s), {len(errors)} error(s), {len(warnings)} warning(s)")
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
