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
- Log in and log out with access (author), admin or approver codes; each opens its own pages
- Mark up photos with arrows, circles and numbers
- Logs for admins: activity (logins, changes, approvals, deletions, exports), print log and code usage
- Approvals by email: drafts print with a DRAFT watermark until an approver signs them off

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
js/admins.js        Admin codes (scrambled)
js/lock.js          Log in / log out and roles
js/log.js           Print log
js/activity.js      Activity log, change history and the Logs page
js/markup.js        Photo markup editor
js/approval.js      Draft / approval requests and signed approvals
js/approvers.js     Approvers (public keys only)
js/app.js           Start-up
scripts/access-code.js  Make, list and remove access codes
scripts/approver-code.js  Make, rename and remove approver codes
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

## Logging in

The app opens with a **Log in** screen. Each person logs in with their own code, and
the code decides what they can do:

| Code | Opens | Can do |
|---|---|---|
| **Access code** (author) | Home page | Products, machines, PDFs, approval requests, backups |
| **Admin code** | Home page | Everything an author can do, plus the **Logs** and **Clear all saved data** |
| **Approver code** | Approvals page only | Review approval requests and sign decisions |

After the code, the app asks **Who are you?**: type your name (it is suggested next
time on that computer). The name is shown at the top of every page, fills in **Prepared
by** on new products and machines and the approver's signing name, and is recorded in
the logs together with the code. The name is not checked: the code is the proof of who
logged in.

The top of every page shows who is logged in, with a **Log out** button. On a shared
computer, log out when you finish; the next person logs in with their own code. A login
is remembered in that browser until Log out, or until **30 minutes without activity**
(no click, key press, touch or scroll, also with the browser closed): then it ends by
itself. A warning with **Stay logged in** shows a minute before. Everything is saved as
you type, so no work is lost. Codes are not case-sensitive, and spaces
and dashes don't matter. Procedures are shared by everyone who uses that browser.

Access and admin codes keep out casual visitors only: the repository is public, so
someone technical can read the app's code and get around them. Approver codes are
different: approvals are digitally signed (see **Approval** below). The logs are
hidden from authors and only included in full backups made by an admin.

Manage access codes from the repository folder (needs Node.js); admin codes work the same
way with `npm run admin -- add / list / remove / find` instead of `npm run code`:

1. Make a new code: `npm run code -- add "Workshop tablet"`.
   The code is shown once (for example `K7QM-4XPA-2R9D`). Write it down: only a
   scrambled version is saved, in `js/access.js`, so it cannot be read back.
   To choose your own code: `npm run code -- add "Office" MYCODE123`.
2. See the names of all codes: `npm run code -- list`.
3. Stop a code working: `npm run code -- remove "Workshop tablet"`.
   Browsers that used it ask for a code again the next time they open the app online.
4. Commit and push the change, and merge it into `main` so the website picks it up.

**Which code made a PDF?** Every PDF carries a short reference, for example `6AA165`, worked
out from the code (the code itself is never in the PDF). It is not printed as text: it is
in the PDF's file properties (Keywords, with the date and time it was made), in hidden
text and in tracking dots (see below). To look it up:

- `npm run code -- find 6AA165` prints the name of the code, for example "Code 1".
- `npm run code -- list` shows every code's name with its PDF reference.

A removed code's reference no longer appears in `list`, so note it down first if you may
need it later.

Where to find the reference:

- **Hidden text:** invisible text at the top and middle of every page:
  `Ref 6AA165 printed 2026-11-17 12:51`. It is not seen or printed, but searching the PDF
  for "Ref" finds it.
- **Tracking dots:** a row of tiny grey dots at the top and bottom of every page, also on
  printed copies and photocopies. To read them:
  1. Look with a magnifier, or zoom in on the PDF or a photo of the page.
  2. The row starts and ends with a pair of dots, one above the other. Skip those.
  3. Between them are 28 dots in 7 groups of 4. For each dot write **0** if it is in the
     upper row, **1** if it is in the lower row.
  4. Run `npm run code -- dots "0110 1010 1010 0001 0110 0101 0110"` (or send me the
     numbers). It names the code, or says the dots were misread: the last group is a
     check, so a single mistake is caught.

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
10. Press **Download PDF**. Each PDF is added to the **Print log**.
11. Use **Export backup** on the home page regularly. Data lives only in this browser.

**Approval:** every product and machine starts as a **Draft**: its PDF has a large red
DRAFT watermark and "Not approved: draft" in the Approved by box. The status box at the
top of its page shows where it is.

1. **Author: request approval.** Press **Request approval**, choose the approver, enter
   their email and yours, and press **Save request and open email**. The app saves
   `Approval request - <name> - rev <n>.zip` and opens an email to the approver. Attach
   that file (from your Downloads folder) and send it. The status is now **Waiting for
   approval**.
2. **Approver: review and decide.** Log in with your approver code: the **Approvals**
   page opens. Press **Choose request file** and pick the .zip from the email. It is opened only for checking; nothing is added to the
   approver's own data. **Download PDF to review** shows it as it will print. Choose
   **Approve** or **Reject** (rejecting needs a comment), type the comment and **your
   name** (it is printed on the PDF as "Approved by" and remembered in that browser)
   and press **Sign and save decision**. It is signed with the code you logged in with
   (after reloading the page, you type the code again to sign). The app saves
   `Approval - <name> - rev <n> - approved.json` (or `rejected`) and opens a reply email:
   attach the file and send it.
3. **Author: import the decision.** Press **Import approval file** on the product's page
   (or Home → Approvals) and choose the .json. The app checks that it was signed with a
   listed approver's code, that the file was not changed, and that the procedure is
   exactly what was approved. It then shows **Approved** (or **Rejected** with the
   comment), for example "Approved by Sam Lee (Approver 1)". Approved PDFs have no
   watermark and print the name the approver typed, with "digital signature checked".
   Which approver code signed it is not printed: it is hidden in the PDF as
   `Approver ref 06DB68` (invisible text, found by searching the PDF for "Approver ref",
   and in the file properties' Keywords). Look it up with
   `npm run approver -- find 06DB68` or `npm run approver -- list`.
4. **Any change** after approval (text, photo, tool, PPE, revision…) makes it a draft
   again, with "Changed after it was approved". Undoing the change makes it approved again.

Approver codes are like passwords for signing: an approval file cannot be made or
altered without one, even by someone who reads the app's code, because only a public
key is stored in `js/approvers.js`. Keep each code secret and never email it. Manage
them with:

- `npm run approver -- add "Sam Lee"`: makes a new code (shown once; write it down).
- `npm run approver -- rename "Approver 1" "Sam Lee"`: renames the code in the list
  (the code stays the same). Optional: approvers type their own name when signing.
- `npm run approver -- remove "Sam Lee"`: approvals signed with that code stop counting,
  so those procedures become drafts.
- `npm run approver -- list`: names with their approver references
- `npm run approver -- find 06DB68`: which approver code a reference belongs to

**Mark up a photo:** press **✎** on a product or packaging photo, or **✎ Mark up** under
a step or sub-step photo. A full-screen editor opens:

1. Pick a tool: **Arrow** (drag from where the arrow starts to the point it shows),
   **Circle** (drag across the part) or **Number** (tap; numbers go 1, 2, 3…).
2. Pick a colour: red, yellow, black or white. Each mark has a thin outline so it
   shows on light and dark backgrounds.
3. **Undo** (or Ctrl+Z) removes the last mark; **Clear** removes them all.
4. **Save** draws the marks into the photo, so they appear in the PDF and backups.
   **Cancel** (or Esc) leaves the photo as it was. After saving, **Undo** in the bar
   at the bottom brings back the photo without marks.

**Logs (admins only):** home page → **Open logs**. Three tabs, each with a filter and a
**Download (Excel / CSV)** button:

- **Activity:** who did what, and when (name and code), newest first:
  - **Login:** logged in, logged out, logged out automatically, failed logins (wrong code).
  - **Change:** lines, products and machines created; edits, recorded when you leave the
    page, make a PDF or log out, with what changed (for example `Revision "1" → "2"; Steps
    1 → 2; Step 1 changed; Safety equipment`); company details; Undo.
  - **Approval:** requests sent (to whom), approvals and rejections imported (by whom,
    with the comment), decisions signed on this computer, approval files refused and why.
  - **Deletion:** products, machines, lines (with their products) and departments.
  - **Export / import:** every exported file, imports, "replace all", clearing data or logs.
- **Print log:** every PDF made: when, what, revision, Draft or Approved, and who made it
  (name, code and reference).
- **Code usage:** every access, admin and approver code with its logins, last login, PDFs
  and the names used with it on this computer. Codes never used here are greyed out:
  candidates for removal.

The logs are kept in this browser (activity up to 5000 entries, print log up to 2000);
each computer has its own. They stay when data is cleared or replaced by a backup, and
only go into full backups made by an admin. **Clear activity log** / **Clear log** empty
them (Undo brings them back until the page is closed).

**Undo:** after removing or replacing something (a step, sub-step, warning or note,
photo, product, machine, line, department, the logo, an import, or clearing all data), a
bar at the bottom shows what happened with an **Undo** button for 10 seconds. Ctrl+Z
(⌘Z on a Mac) also undoes when you are not typing in a field. Up to 20 actions can be
undone, until the page is closed or reloaded. Undo puts back everything as it was before
that action: if you changed more since then, it asks first, and **Cancel** keeps your
later work.

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
