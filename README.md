# Setup Procedure Generator

Browser-based tool for writing work setup procedures, per product (grouped by line) and per machine.

- Photos of the product/machine and packaging or control panel
- Step-by-step guides, each with an optional headline and photo
- Clean black-and-white PDF with a Time required / Technicians required table and Prepared by / Approved by sign-off (empty fields are left blank to fill in by pen)
- Company logo at the top of every PDF (set once on the home screen)
- Data is stored in the browser (localStorage); export and import a JSON backup

## Project structure

```
index.html          Page markup; loads the CSS, jsPDF and the scripts below
css/styles.css      All styles (light and dark mode)
js/utils.js         Pure helpers: id, esc, tot, parseBackup (unit tested)
js/app.js           App state, rendering, events, backup and PDF export
tests/              Node unit tests for js/utils.js
```

`js/utils.js` must load before `js/app.js`, because the app uses its helpers.

## Run

1. Clone the repository and switch to the branch:
   `git clone https://github.com/deninluvis/setup-procedure-generator.git`
   then `cd setup-procedure-generator` and `git checkout claude`
2. Open `index.html` in a browser. No build step is needed.
3. Optional: serve it locally with `npm start` (or `python3 -m http.server 8000`)
   and open http://localhost:8000.

The PDF uses jsPDF and the IBM Plex Sans font, both loaded from a CDN, so an internet connection is needed.

## How to use

1. On **Products**, add a product line (for example "Line 1"), then add a product to it.
   Or switch to **Machines** and add a machine.
2. Fill in the code or asset number, the revision and photos.
3. Add steps. Each step has an optional headline, a description and an optional photo.
   Use ↑ ↓ to reorder.
4. Enter **Prepared by** and **Approved by**, then press **Download PDF**.
5. Use **Export backup** regularly. Data lives only in this browser.

## Tests

Requires Node.js 18 or newer. No dependencies to install.

```
npm test
```

## Notes

The app was first built as a Claude artifact. PDF and backup saving use the artifact
`downloads` capability when available and fall back to a normal browser download elsewhere.
