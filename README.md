# Setup Procedure Generator

Browser-based tool for writing work setup procedures, per product (grouped by line) and per machine.

- Photos of the product/machine and packaging or control panel
- Step-by-step guides, each with an optional headline and photo (kept together on one PDF page)
- Clean black-and-white PDF with a Time required / Technicians required table and Prepared by / Approved by sign-off (empty fields are left blank to fill in by pen)
- Company logo, company name and departments, set once on first visit; each product or machine picks its department, printed on its PDF
- Data is stored in the browser (IndexedDB, typically hundreds of MB or more); a storage meter on the home page shows space used and free; export and import backups as .zip files with photos as normal image files
- Export & import page: tick exactly what to export or import in a tree (everything, company details, lines, products, machines)
- Backup reminder after 7 days without a backup
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
   Type in the search box to find a product or machine by name, code, product line or
   department; click a result (or press Enter for the first one) to open it.
   Use **Edit company details** to change the logo or name, or to add, rename or
   remove departments later.
3. **Products:** add a product line (for example "Line 1"), then add a product to it.
   **Machines:** add a machine.
4. On a product or machine page, the **How to fill in this product/machine** panel
   explains each part (closed at first: click it to open; it stays as you left it).
   Pick the **Department**, then fill in the code or asset number, the revision and photos.
5. Add steps. Each step has an optional headline, a description and an optional photo.
   - **＋ Insert step below** adds a step right after that one; **＋ Add step** adds one
     at the end. Steps renumber automatically.
   - **Move to** jumps a step straight to another position; **↑ ↓** move it one place.
   - **＋ Add sub-step** adds numbered sub-steps (2.1, 2.2, …) inside a step, each with
     its own text and optional photo, and ↑ ↓ ✕ to arrange them. In the PDF they are
     printed indented under their step, kept on the same page where possible.
   - Deleting a step that has sub-steps asks first.
6. In **Sign-off**, fill in Time required and Technicians required (or leave them
   empty to write in by pen), then Prepared by and Approved by.
7. Optionally tick **Add watermark to the PDF**: the company name and the item's
   department are printed large, faint and diagonally across every page. The choice is
   remembered in this browser.
8. Press **Download PDF**.
9. Use **Export backup** on the home page regularly. Data lives only in this browser.

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

Everything is on the **Export & import** page (home page → **Backup and sharing** →
**Export & import**). A **How export and import work** panel at the top of the page
explains the steps (closed at first: click it to open; it stays as you left it). **Quick full backup** on the home page exports everything in
one click.

### Export

A tree lists everything, each with a tick box:

```
☑ Everything (full backup)
   ☑ Company details and logo
   ☑ Products
      ☑ Line 1
         ☑ Widget A   WA-1 · Assembly
         ☑ Widget B   WB-2 · Press Shop
      ☑ Line 2 …
   ☑ Machines
      ☑ Press 3      P3 · Press Shop
```

- Ticking a group ticks everything in it; a group shows a dash when only part is ticked.
- **Group by:** *Product line* (Products → lines → products, then Machines) or
  *Department* (each department with its products and machines, then "No department").
  One tick selects a whole department.
- **Filter:** type in the filter box to show only items whose name, code, product line
  or department matches. Ticking a group then ticks only the items shown; hidden items
  keep their ticks. The grouping and filter apply to the import list too.
- The *Group by* choice and collapsed groups are remembered in this browser.
- ▾ / ▸ collapses or expands a group.
- The page shows what is selected and the approximate file size.
- With **everything** ticked you get a full backup:
  `setup-procedures-backup-YYYY-MM-DD.zip` (this also updates "Last backup").
- Otherwise you get `setup-procedures-export-YYYY-MM-DD.zip` with just the ticked
  items, or `Widget A - product - YYYY-MM-DD.zip` for a single item.

Shortcuts: **Export this line** on a line page, **Export this product / machine** on its page.

The ZIP holds `data.json` (all text) plus photos as normal image files:

```
data.json
logo.png
photos/Line 1/Widget A/product-1.jpg
photos/Line 1/Widget A/step-2.jpg
photos/Line 1/Widget A/step-2-1.jpg   (photo of sub-step 2.1)
photos/Machines/Press 3/panel-1.jpg
```

Every export also contains a `READ ME.txt` with these rules:

- **Keep the exported file as it is.** Do not rename, move or delete files or folders
  inside the `.zip`, do not change file extensions, and do not edit `data.json`: the
  app finds every photo by its exact folder and file name. A changed name means a
  missing photo; a damaged `data.json` cannot be imported at all.
- **The only safe change is replacing a photo:** save the new photo with exactly the
  same file name, in the same folder. If you unzip to do that, zip it again with
  `data.json` and the `photos` folder inside, keeping every folder as it was.

A ZIP re-saved by Windows, macOS or other tools, even inside an extra folder, still
imports. Older `.json` backups still import.

### Import

Press **Choose files** (one or several files) — or **Import backup** on the Welcome
screen. The page shows what is inside as the same kind of tree, with each item marked
**new** or **already exists**. Tick what to import, then press **Import selected**.

- **Full backup file:** choose **Replace all current data with this backup**, or
  **Add only what I tick** to the current data.
- **When an item already exists:** replace it, or keep both (the imported one gets
  "(imported)", then "(imported 2)" and so on).
- Products go into the product line with the same name; it is created if missing.
  Departments are matched by name and added if missing.
- **Company details and logo**, when ticked, replace the company name and logo and
  add any missing departments. For full backups in "add" mode this is unticked by
  default.
- If photos cannot be loaded, the page lists each one before you import: which product
  or machine, which photo (for example "Step 2 photo"), the exact file path it looked
  for, and whether it was not found or not a readable image. When a file with a similar
  name is in the ZIP (for example `.JPG` instead of `.jpg`), it says so. The list stays
  after importing (only for what you imported), so you know what to fix.

### Backup reminder

The home page shows when you last exported a full backup. After 7 days (or if you
never have), a reminder box with an **Export backup** button appears at the top.

## Tests

Requires Node.js 18 or newer. No dependencies to install.

```
npm test
```

## Notes

The app was first built as a Claude artifact. PDF and backup saving use the artifact
`downloads` capability when available and fall back to a normal browser download elsewhere.
