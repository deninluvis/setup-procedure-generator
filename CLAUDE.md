# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A browser-only app (no build step, no framework, no backend) for writing work setup
procedures per product (grouped by product line) and per machine, and exporting them
as a black-and-white/colour PDF. Data lives only in the user's browser. Work is done on
the `claude` branch.

## Commands

- Run: open `index.html` directly, or `npm start` (serves on http://localhost:8000).
- Tests (Node 18+, no dependencies): `npm test` (= `node --test tests/*.test.js`).
- Single test file: `node --test tests/zip.test.js`
- Single test by name: `node --test --test-name-pattern="addItem" tests/utils.test.js`
- Formatting: code is formatted with Prettier 3.3.3 (`npx -y prettier@3.3.3 --write js/*.js css/styles.css index.html`). There is no linter config.
- Only `js/utils.js` and `js/zip.js` are unit tested. UI and PDF behaviour are verified by driving the page with Playwright (not part of the repo). jsPDF loads from cdnjs; if the CDN is unreachable, route that URL to a local copy of `jspdf@2.5.1/dist/jspdf.umd.min.js`.

## Architecture

Classic `<script>` files (not ES modules) share globals; load order in `index.html` matters:
jsPDF (CDN) → `js/utils.js` → `js/storage.js` → `js/zip.js` → `js/app.js`.
`utils.js` and `zip.js` end with `if (typeof module !== "undefined") module.exports = …` so the Node tests can `require` them. Keep that guard, and keep `utils.js` free of DOM access.

### State and rendering (`js/app.js`)
- One mutable global `S` holds all data: `{ co: {name, depts:[{id,name}], done}, logo, lines:[{id,name,products:[item]}], machines:[item], lastBackup }`. Products and machines share one item shape: `{id, name, code, rev, date, dept, prod:[img], pack:[img], tools:[{n,s,q}], steps:[{h, t, img, warn, wtype, subs:[{t, img, warn, wtype}]}], th, tm, tech, by, appr}`. Images are JPEG/PNG data URLs. Missing optional fields mean "not set" (e.g. `warn === undefined` = no note box; no `wtype` = "warning"; no `dept` = first department via `deptOf`).
- Navigation globals: `T` = screen (`"co"` company setup, `"h"` home, `"p"` products, `"m"` machines, `"x"` export & import), `V = {l, p}` = selected line/product, `MID` = selected machine. `P()` returns the item being edited (product or machine).
- `R(keep)` re-renders the whole screen by building an HTML string into `#app`. `keep = true` keeps the scroll position and restores focus/caret via `data-*` attribute selectors. Views: `CoV`, `HomeV`, `MV`, the product/machine page inside `R`, `XV` (export & import); helpers such as `stepHtml`, `noteHtml`, `toolsHtml`, `tree`.
- Events use document-level delegation: `click` dispatches on `data-a="<action>"` (with `data-i`/`data-j` indexes) in one large if/else chain, then calls `save()` and `R()`. Typing goes through the `input` listener, which writes into `S` by data attribute (`data-f` field, `data-h`/`data-s` step, `data-ss` sub-step, `data-w` note, `data-tool`). It saves but does not re-render. File inputs, selects and tick boxes go through the `change` listener.
- Any user-visible text built into HTML must go through `esc()`.

### Persistence (`js/storage.js`, global `Store`)
- IndexedDB database `setup-procedures`, store `kv`: key `"state"` holds `S` with every image replaced by an `"img:<id>"` reference, and each image is its own record. Image-bearing fields are walked by `mapImgs` in `utils.js`; when adding a new image field, update `mapImgs`, `imgPlanner.item`, `imgRefs` and `imgBytes` together.
- Falls back to localStorage key `sp` (about 5 MB) when IndexedDB is unavailable; data found under `sp` is migrated to IndexedDB on load.
- `save()` writes immediately (one write in flight plus one queued); `writeNow()` resolves `false` when storage is full, and callers use it to roll back photo and logo additions.
- Per-browser UI preferences (Group by, collapsed tree groups, help panels open, watermark, PDF photo size) live in localStorage `sp-view`, separate from the data. Every access is wrapped in try/catch.

### Backups and sharing (`js/zip.js` + `utils.js`)
- `Zip.make` writes stored (uncompressed) entries with UTF-8 names. `Zip.read` also inflates deflated entries via `DecompressionStream`, so ZIPs re-saved by Windows/macOS still import.
- Export ZIP layout: `data.json` (images replaced by relative paths such as `photos/<line>/<product>/step-2-1.jpg`), the image files, `logo.png`, and `READ ME.txt`. Planned by `planBackup(S)` (full backup) or `planItems(list, company)` (selection; format `"setup-procedures-items"`). The older single-item format `"setup-procedures-item"` and plain-JSON backups must keep importing.
- Import: `readFile` → `fileContents` (packs, company, full backup) → preview on the `"x"` screen → `applyImport`, which either replaces `S` or merges via `addItem` (line and department matched by name). `imgRefs`/`similarPath` build the missing-photo report.

### PDF (`mkPdf` in `app.js`)
- jsPDF A4 in mm, drawn top to bottom with a running `y` and `need(h)` for page breaks. `stepH`/`subH` precompute heights so a step (with its notes, photos and sub-steps) stays on one page when it fits, and the "Procedure" heading stays with step 1.
- Order: header (company · department · "Setup procedure", logo top right), meta row, product and packaging photos, Tools required table, Procedure, Approval (time/technicians table, then signatures), footer and optional watermark on every page.
- Note colours are defined twice and must stay in sync: `NOTE_PDF` in `mkPdf` and the `--dg`/`--cau`/`--nt` CSS variables. Photo print sizes come from `PHOTO_SIZES`.
- The built-in Helvetica font has no symbol glyphs; the warning triangle and info circle are drawn with shapes.

### Undo
`remember(msg)` must be called before a destructive change. It stores a deep copy of `S` (strings are shared, not copied) plus `T`/`V`/`MID` on a 20-entry stack and shows the toast. `undo()` restores state and re-renders. Small removals rely on Undo instead of `confirm()`; large ones (delete product/machine/line, replace all, clear all) confirm and also call `remember`.

## Conventions

- User-facing text is plain, short English; the in-app help panels (`xHelp`, `itemHelp`) and `README.md` describe behaviour and should be updated when features change.
- Keep the app working when opened from `file://`: no ES module imports and no fetches other than the jsPDF CDN script and the Google Fonts stylesheet.
