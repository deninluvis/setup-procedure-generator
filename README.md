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
- Safety equipment (PPE) printed as safety signs at the top of the PDF
- Works offline: everything it needs is in the repository, and it can be installed as an app
- Access codes: a code is asked for before the app opens

## Project structure

```
index.html          Page markup; loads the CSS, jsPDF and the scripts below
css/styles.css      All styles (light and dark mode)
js/utils.js         Pure helpers (unit tested)
js/storage.js       Saving and loading (IndexedDB, with a localStorage fallback)
js/zip.js           Built-in ZIP writer/reader for backups (no library needed)
js/state.js         App state, saving, remembered view settings
js/ppe.js           Safety equipment (PPE) list and safety-sign pictures
js/views.js         Screens and the HTML they are built from
js/undo.js          Undo and the message bar at the bottom
js/transfer.js      Export & import page and .zip backups
js/pdf.js           PDF export
js/events.js        Clicks, typing and other user actions
js/access.js        Access codes (scrambled)
js/lock.js          Access code screen
js/app.js           Start-up
scripts/access-code.js  Make, list and remove access codes
sw.js               Offline support when served from a web address
manifest.webmanifest, icons/   Install as an app
vendor/             jsPDF and the IBM Plex Sans font, stored locally
tests/              Unit tests (Node) and browser tests (tests/e2e, Playwright)
.github/workflows/  Runs all tests on GitHub on every push
```

The scripts share globals and load in the order listed in `index.html`.

## Run

1. Clone the repository and switch to the branch:
   `git clone https://github.com/deninluvis/setup-procedure-generator.git`
   then `cd setup-procedure-generator` and `git checkout claude`
2. Open `index.html` in a browser. No build step is needed.
3. Optional: serve it locally with `npm start` (or `python3 -m http.server 8000`)
   and open http://localhost:8000.

No internet connection is needed: jsPDF (the PDF library) and the IBM Plex Sans font are
stored in `vendor/`.

### Install as an app (optional)

When the app is opened from a web address (for example GitHub Pages, or `npm start`),
the browser can install it like a normal app and it keeps working offline:

- **Chrome / Edge (computer):** click the install icon at the right of the address bar.
- **Android (Chrome):** menu ⋮ → **Add to Home screen** / **Install app**.
- **iPhone / iPad (Safari):** Share → **Add to Home Screen**.

After the first visit the app opens with no connection. When online, it picks up
updates automatically.

Data is kept per address: data entered at `file://…/index.html` is not visible at a web
address, and the other way round. Use **Export backup** and **Import** to move it.

To publish on GitHub Pages: repository **Settings → Pages → Build and deployment →
Deploy from a branch**, pick `main` and `/ (root)`, then **Save**. The address appears on
the same page after a minute or two.

## Access codes

The app asks for an access code before it opens. Codes are not case-sensitive, and
spaces and dashes don't matter. A correct code is remembered in that browser, so it is
asked for only once.

This keeps out casual visitors only. The repository is public, so someone technical
can read the app's code and get around it. Your procedures are never on the website:
they stay in each person's browser.

Manage codes from the repository folder (needs Node.js):

1. Make a new code: `npm run code -- add "Workshop tablet"`.
   The code is shown once (for example `K7QM-4XPA-2R9D`). Write it down: only a
   scrambled version is saved, in `js/access.js`, so it cannot be read back.
   To choose your own code: `npm run code -- add "Office" MYCODE123`.
2. See the names of all codes: `npm run code -- list`.
3. Stop a code working: `npm run code -- remove "Workshop tablet"`.
   Browsers that used it ask for a code again the next time they open the app online.
4. Commit and push the change, and merge it into `main` so the website picks it up.

With no codes listed in `js/access.js`, the app opens without asking.

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
5. Under **Safety equipment (PPE)**, tick what must be worn: safety glasses, gloves,
   ear protection, safety shoes, hard hat, hi-vis vest, face shield or dust mask. Each one
   prints as a blue safety sign with its name under the header of the PDF. Type anything
   else in **Other safety equipment**; it prints under the signs.
6. Under **Tools required**, press **＋ Add tool** and enter each tool with its size or
   specification and quantity (Enter adds the next row; names you used before are
   suggested). In the PDF they print as a table before the procedure, with a box to
   tick for each tool.
7. Add steps. Each step has an optional headline, a description and an optional photo.
   - **＋ Insert step below** adds a step right after that one; **＋ Add step** adds one
     at the end. Steps renumber automatically.
   - **↑ ↓** move a step up or down.
   - **＋ Add sub-step** adds numbered sub-steps (2.1, 2.2, …) inside a step, each with
     its own text and optional photo, and ↑ ↓ ✕ to arrange them. In the PDF they are
     printed indented under their step, kept on the same page where possible.
   - Deleting a step that has sub-steps asks first.
   - **⚠ Add warning or note** on a step or sub-step adds a box with a type and a
     description: **Warning** (serious hazard, red), **Caution** (risk of damage,
     orange) or **Note** (useful tip, blue). In the PDF it prints in a box with the same
     colour edge, a symbol, and WARNING / CAUTION / NOTE next to it, followed by the
     description.
8. In **Sign-off**, fill in Time required and Technicians required (or leave them
   empty to write in by pen), then Prepared by and Approved by.
9. Optionally tick **Add watermark to the PDF**: the company name and the item's
   department are printed large, faint and diagonally across every page. The choice is
   remembered in this browser.
   Choose the **Photo size in the PDF**: Small, Medium (default) or Large. Photos keep
   their full resolution, so they stay sharp when zoomed at any size.
10. Press **Download PDF**.
11. Use **Export backup** on the home page regularly. Data lives only in this browser.

**Undo:** after removing or replacing something (a step, sub-step, warning or note,
photo, product, machine, line, department, the logo, an import, or clearing all data), a
bar at the bottom shows what happened with an **Undo** button for 10 seconds. Ctrl+Z
(⌘Z on a Mac) also undoes when you are not typing in a field. Up to 20 actions can be
undone, until the page is closed or reloaded.

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

Requires Node.js 18 or newer.

1. Unit tests (no dependencies to install):
   ```
   npm test
   ```
2. Browser tests: these open the real app in Chromium and check the main features
   (company setup, products and machines, PPE, tools, steps and warnings, the PDF,
   undo, search, export and import, and working with no internet connection).
   Install Playwright once, then run them:
   ```
   npm install --no-save playwright@1.63.0
   npx playwright install chromium
   npm run test:e2e
   ```

Both run automatically on GitHub for every push and pull request (the **Actions** tab,
workflow **Tests**). A red ✕ next to a commit means a test failed: open it to see which.

## Notes

The app was first built as a Claude artifact. PDF and backup saving use the artifact
`downloads` capability when available and fall back to a normal browser download elsewhere.
