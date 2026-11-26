# Lesson content

One JSON file per sub-lesson: `src/content/<tab>/<lesson>/<sub>.json`, for example `src/content/t1/l01/s01.json`
(tab 1, main lesson 1, sub-lesson 1, id `t1.l01.s01`). A sub-lesson without a file shows a "coming soon" page.
The title of every sub-lesson lives in `src/course.json` (`sub_titles`); the content file does not repeat it.

Check and build:

```powershell
python -I src/tools/validate_content.py    # checks every file, prints what is wrong
python -I src/build.py                     # runs the same checks first, then builds
```

Every text is `{"en": "...", "fr": "..."}`. Both languages are required.

## File shape

```json
{
  "id": "t1.l01.s01",
  "summary": {"en": "...", "fr": "..."},
  "goals":   [{"en": "...", "fr": "..."}],          // 2 to 5, shown on page 1
  "pages":   [ { "id": "p1", "title": {...}, "blocks": [...], "sources": [...] } ],   // 1 to 4 pages: p1, p2, ...
  "quiz":    { "questions": [ ... ] }                // exactly 8 for a sub-lesson (20 for a final quiz)
}
```

**Working plan from sub-lesson 1.1.2 on: ONE lesson page (`p1`) plus the 8 quiz pages, so 9 pages per sub-lesson.**
Use `h` headings inside that page to organise it (a chip can jump to any heading). 1.1.1 keeps its three pages.
A one-page lesson is shown without the page stepper and without "Page 1 of 1".

## Page blocks

| type | fields |
|---|---|
| `p` | `text` |
| `h` | `id` (lowercase, hyphens; a chip can jump to it), `text` |
| `list` | `items` (texts), optional `ordered` |
| `facts` | `items`: `{value: "240 MHz", label: text}` (2 to 8) |
| `table` | `head` (texts), `rows` (cells are plain strings or texts) |
| `callout` | `kind` = `tip` / `note` / `warn`, `title`, `text` |
| `flow` | `items`: `{icon, title, text}` (2 to 6, drawn with arrows) |
| `steps` | `items`: `{title, text}` (2 to 6, numbered) |
| `code` | `lang` = `c cpp bash ini json markup powershell python plain`, `code`, optional `caption` |
| `code` (from the firmware) | `firmware` = file of `src/firmware`, `start` = text found in its first line (only once in the file), `end` = text of the last line. The build copies the lines, so a lesson never differs from the firmware |
| `figure` | `name` (a picture of `src/references/figures.json`), `caption` |
| `gallery` | `items`: `{name or icon, title, text, ref}` (2 to 12 components; `ref` = one source) |
| `refs` | `items` = sources (as below): links to the exact page, placed next to the idea they explain |

Inline markup inside any text: `**bold**`, `*italic*`, `` `code` ``,
`[[label|t1.l01.s01/p2#section-id]]` (a concept chip: jumps to that sub-lesson, page and section, with a Back button),
`[label](https://...)` (an outside link; the app marks it "online").

## Sources

Each page lists where its facts come from. The build looks up the page number and link by section title:

```json
{"doc": "datasheet", "section": "4.1.1 CPU"}
{"doc": "trm", "section": "..."}   {"doc": "idf", "section": "..."}
{"doc": "arduino", "page": "api/ledc", "section": "ledcattach"}
```

Use the exact section title from `src/references/index.json` (PDFs) or `arduino_index.json` (Arduino core docs).
If a title appears twice, add `"page": N`. If you have `pypdf` installed, the validator also opens the PDF and checks that the
heading really is on the page the index gives; when the index is wrong, add `"pdf_page": N` with the real page (done for 4.1.3).

In tabs 3 and 4 every document link opens the PDF of `docs/` carried inside the app (no internet). Documents over 8 MB reach the phones as light copies (same pages, only the cited ones filled), so cite exact pages. Their sub-lessons have seven parts:
1 why, 2 useful concepts, 3 code, 4 development, 5 PlatformIO, 6 pitfalls and safety, 7 conclusion, then the quiz (tab 3: 1 to 4 pages, tab 4: 1 page).

## Questions (8 per sub-lesson, at least 4 different types, every `explain` required)

| type | fields |
|---|---|
| `single` | `prompt`, `options` (exactly 4, one with `"correct": true`) |
| `multi` | `prompt`, `options` (5 or more; between 2 and all-but-one are correct) |
| `truefalse` | `prompt`, `answer` (true or false) |
| `code_output` | `prompt`, `code: {lang, text}`, `options` (exactly 4, one correct) |
| `fill_blank` | `prompt`, `template` with `{1}` `{2}` markers in both languages, `choices` (more than blanks), `blanks: {"1": "choiceId"}` |
| `order` | `prompt`, `items` (3 to 6, written in the CORRECT order; the app shuffles them) |

Options are `{"id": "a", "text": ..., "correct": true}` and may use a plain string (not `{en, fr}`) when the text is the same in
both languages, such as code output. A `flow` icon must be one of the icons listed in `ICONS` in `src/build.py` (add it there if new).
Results are stored per quiz, not per question, so questions can be improved later without touching anyone's progress.

## Rules for Basic Concepts and FreeRTOS · Linking · PlatformIO (tabs 1 and 2)

General ESP32 teaching only. The words listed in `rules.banned_words_tabs_1_2` (`src/course.json`) are refused by the validator.
After publishing a change, raise `app.version` in `src/course.json` so installed apps show "Update available".
