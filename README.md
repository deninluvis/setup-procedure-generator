# Setup Procedure Generator

Browser-based tool for writing work setup procedures, per product (grouped by line) and per machine.

- Photos of the product/machine and packaging or control panel
- Step-by-step guides, each with an optional headline and photo (kept together on one PDF page)
- Clean black-and-white PDF with a Time required / Technicians required table and Prepared by / Approved by sign-off (empty fields are left blank to fill in by pen)
- Company logo, company name and departments, set once on first visit; each product or machine picks its department, printed on its PDF
- Data is stored in the browser (IndexedDB, typically hundreds of MB or more); a storage meter on the home page shows space used and free; export and import backups as .zip files with photos as normal image files
- Export a single product or machine and import it into someone else's app
- High-quality photos (up to 2000 px) so the PDF can be zoomed on a phone or computer

## Project structure

```
index.html          Page markup; loads the CSS, jsPDF and the scripts below
css/styles.css      All styles (light and dark mode)
js/utils.js         Pure helpers (unit tested)
js/storage.js       Saving and loading (IndexedDB, with a localStorage fallback)
js/zip.js           Built-in ZIP writer/reader for backups (no library needed)
js/app.js           App state, rendering, events, backup and PDF export
tests/              Node unit tests for js/utils.js and js/zip.js
```

`js/utils.js`, `js/storage.js` and `js/zip.js` must load before `js/app.js`, because the app uses them.

## Run

1. Clone the repository and switch to the branch:
   `git clone https://github.com/deninluvis/setup-procedure-generator.git`
   then `cd setup-procedure-generator` and `git checkout claude`
2. Open `index.html` in a browser. No build step is needed.
3. Optional: serve it locally with `npm start` (or `python3 -m http.server 8000`)
   and open http://localhost:8000.

The PDF uses jsPDF and the IBM Plex Sans font, both loaded from a CDN, so an internet connection is needed.

## How to use

1. **First visit:** the Welcome screen asks for your company logo, company name
   and departments (use **+ Add department** for each one). Press **Continue**. (Moving from another computer? Use
   **Import backup** on that screen instead.)
2. **Home page:** shows your company and two options, **Products** and **Machines**.
   Use **Edit company details** to change the logo or name, or to add, rename or
   remove departments later.
3. **Products:** add a product line (for example "Line 1"), then add a product to it.
   **Machines:** add a machine.
4. Pick the **Department**, then fill in the code or asset number, the revision and photos.
5. Add steps. Each step has an optional headline, a description and an optional photo.
   Use ↑ ↓ to reorder.
6. In **Sign-off**, fill in Time required and Technicians required (or leave them
   empty to write in by pen), then Prepared by and Approved by.
7. Press **Download PDF**.
8. Use **Export backup** on the home page regularly. Data lives only in this browser.

## Storage

- Data is saved in the browser's IndexedDB storage. The amount allowed depends on the
  browser and free disk space, usually hundreds of MB or more. The home page shows
  how much is used and free.
- Each photo is about 0.3–1 MB, so expect roughly 1–3 MB per procedure with photos.
- Where IndexedDB is not available, the app falls back to localStorage (about 5 MB)
  and says so on the home page.
- Data saved by older versions is moved over automatically on first load.
- Clearing the browser's site data deletes everything, so export backups regularly.

## Backup and sharing

**Full backup:** on the home page press **Export backup**. You get
`setup-procedures-backup-YYYY-MM-DD.zip`:

```
data.json                          all text: company, departments, products, steps…
logo.png
photos/Line 1/Widget A/product-1.jpg
photos/Line 1/Widget A/packaging-1.jpg
photos/Line 1/Widget A/step-2.jpg
photos/Machines/Press 3/panel-1.jpg
```

`data.json` refers to each photo by its path. **Import** reads the ZIP, puts every
photo back in place and replaces all current data (after asking).

- You can replace a photo inside the ZIP with a better one: keep the same file name.
  Any image type works; it is converted for the PDF if needed.
- A photo missing from the ZIP is left empty and the import tells you how many.
- A ZIP re-saved by Windows, macOS or other tools, even inside an extra folder,
  still imports.
- Older `.json` backups still import.

**Share one product or machine:** on its page press **Export this product** (or
machine). You get `Widget A - product - YYYY-MM-DD.zip`. In the other app, press
**Import** on the home page. It is **added** to the existing data, not replacing it:

- Products go into the product line with the same name; it is created if missing.
- The department is matched by name, and added to the company details if missing.
- If one with the same name already exists there, you choose: replace it, or keep both
  (the new one gets "(imported)").

## Tests

Requires Node.js 18 or newer. No dependencies to install.

```
npm test
```

## Notes

The app was first built as a Claude artifact. PDF and backup saving use the artifact
`downloads` capability when available and fall back to a normal browser download elsewhere.
