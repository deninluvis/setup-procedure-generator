// Backups and sharing: writing and reading .zip files, the Export & import
// page (tree, preview, import) and file downloads.
// ---------- Export and import (.zip, or older .json backups) ----------

// Image data -> bytes, and bytes -> image data.
const dataToBytes = (d) => {
  const b = atob(d.slice(d.indexOf(",") + 1)),
    u = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
  return u;
};
const bytesToData = (bytes, type) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(new Blob([bytes], { type }));
  });
// Image type from the file's first bytes (a replaced photo may have any name).
const sniff = (b) =>
  b[0] == 0xff && b[1] == 0xd8
    ? "image/jpeg"
    : b[0] == 0x89 && b[1] == 0x50
      ? "image/png"
      : b[0] == 0x52 && b[8] == 0x57
        ? "image/webp"
        : b[0] == 0x47 && b[1] == 0x49
          ? "image/gif"
          : b[0] == 0x3c || (b[0] == 0xef && b[3] == 0x3c)
            ? "image/svg+xml"
            : "";

// The data for a full backup: the print log only goes into backups made by
// an admin (authors cannot see it).
const backupState = () =>
  isAdmin() ? S : { ...S, log: undefined, act: undefined };

// plan: { data, files } from planBackup() or planItems().
async function exportZip(plan, name, btn, done) {
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Exporting…";
  try {
    const files = [
      {
        name: "data.json",
        data: new TextEncoder().encode(JSON.stringify(plan.data, null, 1)),
      },
    ];
    for (const [p, d] of plan.files)
      files.push({ name: p, data: dataToBytes(d) });
    files.push({
      name: "READ ME.txt",
      data: new TextEncoder().encode(README_TXT()),
    });
    await dl(name, Zip.make(files));
    logAct("data", `Exported "${name}"`);
    toast(`Export saved: ${name}`, false);
    if (done) done();
  } catch (e) {
    alert("Could not create the export file.");
  } finally {
    btn.disabled = false;
    btn.textContent = label;
  }
}

// Read one .zip or .json file -> { data, missing, missingList } (data null if
// unreadable). missingList says which photos could not be loaded, and why.
async function readFile(f) {
  let data = null,
    missing = 0,
    missingList = [];
  try {
    const buf = await f.arrayBuffer();
    if (Zip.isZip(buf)) {
      const z = await Zip.read(buf),
        key = [...z.keys()].find(
          (k) => /(^|\/)data\.json$/i.test(k) && !k.startsWith("__MACOSX"),
        );
      if (!key) throw 0;
      // The ZIP may have been re-saved inside a folder: paths are relative to data.json.
      const root = key.slice(0, -"data.json".length),
        raw = JSON.parse(new TextDecoder().decode(z.get(key))),
        imgs = new Map(),
        unreadable = new Set();
      for (const p of imgPaths(raw)) {
        const b = z.get(root + p);
        if (!b) continue;
        unreadable.add(p); // removed again below once the image is read
        const type = sniff(b),
          logo = p == raw.logo;
        // Photos must be JPEG and the logo PNG or JPEG for the PDF; convert others.
        let d =
          type == "image/jpeg" || (logo && type == "image/png")
            ? await bytesToData(b, type)
            : null;
        if (!d && type)
          d = await comp(new Blob([b], { type }), logo, logo ? 1000 : 2000);
        if (d) {
          imgs.set(p, d);
          unreadable.delete(p);
        }
      }
      ({ data, missing } = restoreImgs(raw, imgs));
      const names = [...z.keys()]
        .filter((k) => k.startsWith(root))
        .map((k) => k.slice(root.length));
      missingList = imgRefs(raw)
        .filter((r) => !imgs.has(r.path))
        .map((r) => ({
          ...r,
          file: f.name,
          reason: unreadable.has(r.path)
            ? "is in the file but could not be read as an image"
            : "was not found in the file",
          similar: unreadable.has(r.path) ? "" : similarPath(r.path, names),
        }));
    } else data = JSON.parse(new TextDecoder().decode(buf));
  } catch (e) {
    data = null;
  }
  return { data, missing, missingList };
}

// ---------- Export & import page ----------

const ACCEPT_IMP = ".zip,.json,application/zip,application/json";
const imgBytes = (p) =>
  [
    ...(p.prod || []),
    ...(p.pack || []),
    ...(p.steps || []).flatMap((s) => [
      ...photosOf(s),
      ...(s.subs || []).flatMap(photosOf),
    ]),
  ]
    .filter(Boolean)
    .reduce((a, v) => a + v.length * 0.75, 0);
const itemSub = (p, dept) =>
  [p.code, dept]
    .filter((x) => String(x || "").trim())
    .map(esc)
    .join(" · ");
const count = (n, one, many) => `${n} ${n == 1 ? one : many}`;

// Tree items. Export keys: "co" company details, "p:<id>" product, "m:<id>"
// machine. Import keys: "co" company details, "i:<n>" the n-th item in the files.
const lineKey = (n) => nameKey(String(n || "").trim() || "Imported");
const exItems = () => [
  ...S.lines.flatMap((l) =>
    l.products.map((p) => ({
      key: "p:" + p.id,
      kind: "product",
      p,
      line: l.name,
      lk: "l" + l.id,
      dept: deptName(deptOf(p, S.co), S.co),
    })),
  ),
  ...S.machines.map((p) => ({
    key: "m:" + p.id,
    kind: "machine",
    p,
    line: "",
    lk: "",
    dept: deptName(deptOf(p, S.co), S.co),
  })),
];
const impItems = () =>
  IMP
    ? IMP.packs.map((pk, i) => ({
        key: "i:" + i,
        kind: pk.kind,
        p: pk.item,
        line: String(pk.line || "").trim() || "Imported",
        lk: lineKey(pk.line),
        dept: String(pk.dept || "").trim(),
        exists: findExisting(S, pk),
      }))
    : [];
const itemsOf = (mode) => (mode == "x" ? exItems() : impItems());
const company = (mode) =>
  mode == "x" ? { name: S.co.name, depts: [] } : IMP && IMP.company;
// All keys, ignoring the filter (for "everything ticked" and initial ticks).
const allKeys = (mode) => [
  ...(company(mode) ? ["co"] : []),
  ...itemsOf(mode).map((x) => x.key),
];

// Filter: matches name, code, product line, department or kind.
const fq = () => XF.trim().toLowerCase();
const shown = (it) =>
  !fq() ||
  [it.p.name, it.p.code, it.line, it.dept, it.kind].some((v) =>
    String(v || "")
      .toLowerCase()
      .includes(fq()),
  );
const coShown = (c) =>
  !!c &&
  (!fq() || ("company details logo " + c.name).toLowerCase().includes(fq()));
const deptKey = (it) => "dept:" + it.dept.toLowerCase();

// Keys in a group, counting only items the filter shows.
function groupKeys(mode, g) {
  const items = itemsOf(mode).filter(shown),
    pick = (f) => items.filter(f).map((x) => x.key);
  if (g == "all")
    return [...(coShown(company(mode)) ? ["co"] : []), ...pick(() => true)];
  if (g == "products") return pick((x) => x.kind == "product");
  if (g == "machines") return pick((x) => x.kind == "machine");
  if (g.startsWith("line:"))
    return pick((x) => x.kind == "product" && "line:" + x.lk == g);
  if (g.startsWith("dept:")) return pick((x) => deptKey(x) == g);
  return [];
}
const exGroup = (g) => groupKeys("x", g),
  impGroup = (g) => groupKeys("i", g);

// Tree nodes, grouped by product line or by department (GRP).
function treeNodes(mode) {
  const items = itemsOf(mode).filter(shown),
    c = company(mode),
    kids = [];
  const leaf = (it) => ({
    key: it.key,
    label: esc(it.p.name || "Untitled"),
    sub:
      GRP == "dept"
        ? [it.kind == "machine" ? "Machine" : "Product · " + it.line, it.p.code]
            .filter((x) => String(x || "").trim())
            .map(esc)
            .join(" · ")
        : itemSub(it.p, it.dept),
    badge:
      mode == "i"
        ? it.exists
          ? `<span class="bd">already exists</span>`
          : `<span class="bd new">new</span>`
        : "",
  });
  const mix = (list) => {
    const np = list.filter((x) => x.kind == "product").length,
      nm = list.length - np;
    return [
      np && count(np, "product", "products"),
      nm && count(nm, "machine", "machines"),
    ]
      .filter(Boolean)
      .join(" · ");
  };
  if (coShown(c))
    kids.push({
      key: "co",
      label: "Company details and logo",
      sub: esc([c.name, ...(c.depts || [])].filter(Boolean).join(" · ")),
    });
  if (GRP == "dept") {
    // Departments in the company's order (export), then as found; "No department" last.
    const groups = new Map();
    if (mode == "x")
      S.co.depts
        .filter((d) => d.name.trim())
        .forEach((d) =>
          groups.set("dept:" + d.name.toLowerCase(), {
            name: d.name,
            items: [],
          }),
        );
    for (const it of items) {
      const k = deptKey(it);
      if (!groups.has(k)) groups.set(k, { name: it.dept, items: [] });
      groups.get(k).items.push(it);
    }
    const none = groups.get("dept:");
    groups.delete("dept:");
    if (none) groups.set("dept:", none);
    for (const [k, gr] of groups)
      if (gr.items.length)
        kids.push({
          group: k,
          label: gr.name ? esc(gr.name) : "<i>No department</i>",
          sub: mix(gr.items),
          children: gr.items.map(leaf),
        });
  } else {
    const lines = new Map();
    if (mode == "x" && !fq())
      S.lines.forEach((l) =>
        lines.set("l" + l.id, { name: l.name, items: [] }),
      );
    for (const it of items.filter((x) => x.kind == "product")) {
      if (!lines.has(it.lk)) lines.set(it.lk, { name: it.line, items: [] });
      lines.get(it.lk).items.push(it);
    }
    const np = items.filter((x) => x.kind == "product").length,
      machs = items.filter((x) => x.kind == "machine");
    if (np || (mode == "x" && !fq()))
      kids.push({
        group: "products",
        label: "Products",
        sub: `${count(lines.size, "line", "lines")} · ${count(np, "product", "products")}`,
        children: [...lines].map(([k, l]) => ({
          group: "line:" + k,
          label: esc(l.name),
          sub: count(l.items.length, "product", "products"),
          children: l.items.map(leaf),
        })),
      });
    if (machs.length || (mode == "x" && !fq()))
      kids.push({
        group: "machines",
        label: "Machines",
        sub: count(machs.length, "machine", "machines"),
        children: machs.map(leaf),
      });
  }
  const top =
    mode == "x"
      ? {
          label: "<b>Everything</b>",
          sub: fq() ? "items matching the filter" : "full backup",
        }
      : {
          label:
            "<b>Everything in the file" +
            (IMP.names.length > 1 ? "s" : "") +
            "</b>",
          sub: fq() ? "items matching the filter" : "",
        };
  if (!kids.length) return [];
  return [{ group: "all", ...top, children: kids }];
}

// Tree with tick boxes. Node: { key } for an item, or { group, children } for a
// group. A group is ticked when all its items are, and shows a dash when some are.
function tree(nodes, mode, sel, groupFn, disabled) {
  const node = (n) => {
    const keys = n.group ? groupFn(n.group) : [n.key],
      on = keys.length > 0 && keys.every((k) => sel.has(k)),
      some = keys.some((k) => sel.has(k)),
      kids = n.children || [],
      cg = mode + "|" + n.group,
      open = !COL.has(cg),
      box = `<input type="checkbox" ${n.group ? `data-cg="${mode}" data-g="${esc(n.group)}"` : `data-ck="${mode}" data-k="${esc(n.key)}"`}${on ? " checked" : ""}${!on && some ? ' data-ind="1"' : ""}${disabled || !keys.length ? " disabled" : ""}>`,
      tg = kids.length
        ? `<button class="tg" data-a="tgl" data-g="${esc(cg)}" aria-expanded="${open}" aria-label="${open ? "Collapse" : "Expand"}">${open ? "▾" : "▸"}</button>`
        : `<span class="tg"></span>`;
    return `<li><div class="tr">${tg}<label>${box}<span>${n.label}</span>${n.sub ? `<span class="m">${n.sub}</span>` : ""}${n.badge || ""}</label></div>${kids.length && open ? `<ul>${kids.map(node).join("")}</ul>` : ""}</li>`;
  };
  return nodes.length
    ? `<ul class="tree">${nodes.map(node).join("")}</ul>`
    : "";
}

// Help panels: <details> boxes that open and close; the state is remembered
// with the other view settings. id: "x" (Export & import) or "item".
const helpBox = (id, title, body) =>
  `<details class="help" data-help="${id}"${HELPS[id] ? " open" : ""}><summary>${title}</summary>${body}</details>`;

// Remember whether a help panel is open ("toggle" does not bubble, so capture it).
document.addEventListener(
  "toggle",
  (e) => {
    // A panel already replaced by a re-render can still send a late "toggle"
    // (from when it was drawn open): ignore it, or it would undo a closing.
    if (!e.target.isConnected) return;
    const id = e.target.dataset && e.target.dataset.help;
    if (id && id in HELPS) {
      HELPS[id] = e.target.open;
      saveView();
      if (id == "item" && !e.target.open) R(true); // shown only while open
    }
    const k = e.target.dataset && e.target.dataset.sec;
    if (k) {
      if (e.target.open) SECS.delete(k);
      else SECS.add(k);
      saveView();
    }
  },
  true,
);

// Rules about the export file, shared by the page help and READ ME.txt.
const KEEP_RULES = [
  "Do not rename, move or delete any file or folder inside the .zip.",
  "Do not edit data.json. It lists every photo by its exact folder and file name.",
  "Do not add, remove or rename folders, and do not change file extensions (.jpg, .png).",
  "If a name or folder changes, that photo is missing after import. A damaged data.json cannot be imported at all.",
];

// Text file added to every export.
const README_TXT = () =>
  [
    "SETUP PROCEDURES EXPORT",
    `Exported on ${dateStamp()} from the Setup Procedure Generator.`,
    "",
    "TO IMPORT",
    "Open the app, go to Export & import, press Choose files and pick this .zip file.",
    "",
    "PLEASE KEEP THIS FILE AS IT IS",
    ...KEEP_RULES.map((r) => "- " + r),
    "",
    "YOU MAY",
    "- Open the photos to look at them, or copy them somewhere else.",
    "- Replace a photo with a better one: save the new photo with EXACTLY the same",
    "  file name, in the same folder, over the old one.",
    "- If you unzip the file to do that, zip it again with data.json and the photos",
    "  folder inside, keeping every folder exactly as it was.",
    "",
    "This READ ME file is ignored when importing.",
    "",
  ].join("\r\n");

// Help at the top of the Export & import page.
// The in-app help is written in ASD-STE100 Simplified Technical English, like
// the user guide (docs/user-guide.pdf): short sentences, one instruction per
// step, "select" = click or touch.
const xHelp = () =>
  helpBox(
    "x",
    "How export and import work",
    `<h3>Export: save or share data</h3>
<ol>
<li>On the <b>Export</b> tab, select the items to export.</li>
<li>To select all items in a group, select the group.</li>
<li>To find items, use the search box or <b>Group by</b>.</li>
<li>Select the button below the list:
<ul>
<li><b>Export full backup</b> (all items selected): makes a copy of all data. Keep the file in a safe location, for example a USB drive or a network folder.</li>
<li><b>Export selected</b> (some items selected): makes a file with only these items. You can send this file to a colleague.</li>
</ul></li>
</ol>
<p>The app downloads a <code>.zip</code> file. The file contains <code>data.json</code> (all the text), the photos in folders and a <code>READ ME.txt</code> file.</p>
<h3>Keep the export file as it is</h3>
<ul>${KEEP_RULES.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>
<p>You can replace a photo in the file. Save the new photo with <b>the same file name, in the same folder</b>. If you unzip the file for this, zip it again with all folders as before. If a problem occurs, import the original file.</p>
<h3>Import: restore or add data</h3>
<ol>
<li>Select the <b>Import</b> tab.</li>
<li>Select <b>Choose files</b>.</li>
<li>Select one or more <code>.zip</code> files. Old <code>.json</code> backups also work.</li>
<li>Examine the list. The app shows each item as <span class="bd new">new</span> or <span class="bd">already exists</span>.</li>
<li>For a full backup, select <b>Replace all current data</b> or <b>Add only what I tick</b>.</li>
<li>Select the items to import.</li>
<li>For items that already exist, select <b>Replace it</b> or <b>Keep both</b>.</li>
<li>Select <b>Import selected</b> (or <b>Replace all data</b>).</li>
</ol>
<p>If photos are missing, the app shows a list. The list shows the product or machine, the photo and the file name.</p>
<h3>Notes</h3>
<ul>
<li>The app keeps your data in this browser only. Make a full backup regularly. After 7 days without a backup, a reminder shows on the Home page.</li>
<li>To move to a different computer, make a full backup. On the other computer, select <b>Import backup</b> on the Welcome page. Then select <b>Replace all current data</b>.</li>
<li>The app puts imported products in the line with the same name. Capital letters and extra spaces are not important. If a line or a department is not there, the app adds it.</li>
<li>The company details and the logo change only if you select them for import.</li>
<li>The app changes nothing until you select the import button. <b>Cancel</b> stops the import.</li>
</ul>`,
  );

// Help at the top of a product or machine page (the ? button).
const itemHelp = (mm) => {
  const it = mm ? "machine" : "product";
  return helpBox(
    "item",
    `How to fill in this ${it}`,
    `<ol>
<li><b>Details.</b> Type the name of the ${it}. Select the <b>Department</b>. Type the ${mm ? "machine ID or asset number" : "product code"}. Increase the <b>Revision</b> number each time that you change the procedure.</li>
<li><b>Photos.</b> In <b>${mm ? "Machine photos" : "Product photos"}</b> and <b>${mm ? "Control panel / nameplate photos" : "Packaging photos"}</b>, select <b>＋ Add photo</b>. You can select more than one photo. To remove a photo, select <b>${IC.x}</b>. To draw arrows, circles or numbers on a photo, select <b>${IC.pen}</b>.</li>
<li><b>Approval.</b> The badge next to the name shows the status: <b>Draft</b>, <b>Waiting</b>, <b>Approved</b> or <b>Rejected</b>. Select the badge to see the details. To request approval, select <b>⋮</b>, then <b>Request approval</b>. When the reply comes, select <b>⋮</b>, then <b>Import approval file</b>. If you change an approved ${it}, it becomes a draft again.</li>
<li><b>Safety equipment (PPE).</b> Select each item that the operator must wear. Each item prints as a safety sign at the top of the PDF. Type other items in <b>Other safety equipment</b>.</li>
<li><b>Tools required.</b> Select <b>＋ Add tool</b>. Type the tool and the size or specification. Push Enter to add the next tool. The tools print as a table before the procedure.</li>
<li><b>Machine settings.</b> Select <b>＋ Add setting</b>. Type the parameter, the value and the unit, for example "Mould temperature, 220, °C". Push Enter to add the next setting. The settings print as a table after the tools.</li>
<li><b>Steps.</b> Write one step for each action:
<ul>
<li>Type a short <b>headline</b>. The headline is optional and prints in bold.</li>
<li>Type the <b>description</b>. Include the values, for example the torque, the speed or the program number.</li>
<li>To add photos, select <b>＋ Add photo</b>. A step can have a maximum of 3 photos. The photos print side by side.</li>
<li>To see a photo in a large size, select it. Then you can select <b>${IC.pen} Mark up</b>, <b>Remove</b>, or <b>${IC.left} Move left</b> / <b>Move right ${IC.right}</b>.</li>
<li>The <b>⋮</b> of a step has <b>Move up</b>, <b>Move down</b>, <b>Insert step below</b>, <b>Add sub-step</b>, <b>Add warning or note</b> and <b>Delete step</b>.</li>
<li>To add a step at the end, select <b>＋ Add step</b>. The app changes the step numbers automatically.</li>
<li>On a computer, you can also drag a step by its handle <b>⠿</b> to a different position.</li>
<li><b>Add warning or note</b> adds a box. Select the type: <b>Warning</b> (risk of injury, red), <b>Caution</b> (risk of damage, orange) or <b>Note</b> (useful information, blue). Then type the text. To remove the box, select <b>${IC.x}</b> in the box.</li>
<li>Sub-steps (3.1, 3.2 …) have their own text, photos and <b>⋮</b>. They print below their step.</li>
<li>Select the title of a section to close it or to open it. The number at the right shows the quantity of items.</li>
</ul></li>
<li><b>Sign-off.</b> Type the <b>Time required</b> (hours and minutes) and the <b>Technicians required</b>. If you keep these boxes empty, you can write the values by hand on the printed PDF. <b>Prepared by</b> must have a name before you can make a PDF.</li>
<li><b>PDF.</b> Select <b>⋮</b>. If necessary, select <b>Add watermark</b> and the <b>Photo size</b>. Then select <b>Download PDF</b>. If a list of missing items shows, select <b>OK</b> to make the PDF. Or, select <b>Cancel</b> and correct the ${it}.</li>
</ol>
<h3>Notes</h3>
<ul>
<li>The app saves your work while you type. There is no Save button.</li>
<li>If you remove an item in error, select <b>Undo</b> at the bottom of the page. On a computer, you can also push Ctrl+Z (⌘Z on a Mac). Undo is available until you close or load the page again.</li>
<li><b>⋮ → Duplicate</b> makes a copy of this ${it} with the name "(copy)". The copy is a draft. <b>⋮ → Duplicate to another line…</b> puts the copy in a different line.</li>
<li><b>⋮ → Export this ${it}</b> makes a file for a colleague.</li>
<li><b>⋮ → Delete ${it}</b> removes the ${it} permanently. Before you delete it, make a backup or an export.</li>
<li>For more information, refer to the <a href="docs/user-guide.pdf" target="_blank" rel="noopener">user guide (PDF)</a>.</li>
</ul>`,
  );
};

// List of photos that could not be loaded, grouped by product or machine.
// done: shown after importing (true) or before (false).
function missingHtml(list, done) {
  if (!list || !list.length) return "";
  const groups = new Map();
  for (const m of list) {
    const k = [m.file, m.kind, m.line, m.item].join("|");
    if (!groups.has(k)) groups.set(k, { m, rows: [] });
    groups.get(k).rows.push(m);
  }
  const files = new Set(list.map((m) => m.file)).size;
  return `<details class="miss" open><summary>${count(list.length, "photo", "photos")} ${done ? (list.length == 1 ? "was" : "were") + " missing and left empty" : "could not be loaded and will be left empty"}</summary>
<p class="m">To fix: put each photo back in the .zip with <b>exactly</b> the folder and file name shown, then import again. Or add the photo later on the ${list.some((m) => m.kind == "machine") ? "product or machine" : "product"} page.</p>
<ul>${[...groups.values()]
    .map(
      ({ m, rows }) =>
        `<li><b>${esc(m.item)}</b> <span class="m">${esc([m.kind == "logo" ? "company details" : m.kind, m.line, files > 1 ? "from " + m.file : ""].filter(Boolean).join(" · "))}</span><ul>${rows
          .map(
            (r) =>
              `<li>${esc(r.what)}: <code>${esc(r.path)}</code> ${esc(r.reason)}.${r.similar ? ` A file with a similar name is in the .zip: <code>${esc(r.similar)}</code>. Rename it to match.` : ""}</li>`,
          )
          .join("")}</ul></li>`,
    )
    .join("")}</ul></details>`;
}

// Filter box and "Group by" switch; they apply to both trees on the page.
function toolbar() {
  const total = exItems().length + (IMP ? IMP.packs.length : 0),
    hits = exItems().filter(shown).length + impItems().filter(shown).length;
  return (
    `<div class="xbar">${sbox(`<input type="search" data-xf="1" value="${esc(XF)}" placeholder="Search products, machines, lines" aria-label="Filter the lists">`, "xf")}<div class="radios seg" role="radiogroup" aria-label="Group by"><span class="m">Group by</span><label><input type="radio" name="grp" value="line"${GRP == "line" ? " checked" : ""}> Product line</label><label><input type="radio" name="grp" value="dept"${GRP == "dept" ? " checked" : ""}> Department</label></div></div>` +
    (fq()
      ? `<p class="m" role="status">Showing ${hits} of ${count(total, "item", "items")}. Ticking a group ticks only the items shown; hidden items keep their ticks. <button class="lk" data-a="xfClear">Clear filter</button></p>`
      : "")
  );
}

function XV() {
  // Export summary
  const prods = S.lines
      .flatMap((l) => l.products)
      .filter((p) => EXS.has("p:" + p.id)),
    machs = S.machines.filter((m) => EXS.has("m:" + m.id)),
    co = EXS.has("co"),
    all = allKeys("x").every((k) => EXS.has(k)),
    bytes =
      [...prods, ...machs].reduce((a, p) => a + imgBytes(p), 0) +
      (co && S.logo ? S.logo.length * 0.75 : 0),
    picked = [
      prods.length && count(prods.length, "product", "products"),
      machs.length && count(machs.length, "machine", "machines"),
      co && "company details",
    ].filter(Boolean);
  let h =
    `<button class="lk" data-a="goSet">← Settings</button><h1>Export &amp; import</h1>` +
    xHelp() +
    (XMSG
      ? `<p class="ok" role="status">${XMSG}</p>` + missingHtml(LASTMISS, true)
      : "") +
    `<div class="tabs" role="group" aria-label="Export or import">${[
      ["ex", "Export"],
      ["im", "Import"],
    ]
      .map(
        ([k, n]) =>
          `<button class="tabb${XTAB == k ? " on" : ""}" data-a="xtab" data-t="${k}" aria-pressed="${XTAB == k}">${n}</button>`,
      )
      .join("")}</div>`;
  if (XTAB == "ex")
    return (
      h +
      `<p class="m">Tick what to export. With everything ticked you get a full backup.</p>` +
      toolbar() +
      (tree(treeNodes("x"), "x", EXS, exGroup, false) ||
        `<p class="m">Nothing matches the filter.</p>`) +
      `<p class="m" role="status">${picked.length ? `Selected: ${picked.join(", ")}${all ? " (full backup)" : ""} · about ${fmtBytes(bytes + 2048)}` : "Nothing selected."}</p>
<div class="row"><button class="b" data-a="xExport"${picked.length ? "" : " disabled"}>${all ? "Export full backup" : "Export selected"}</button></div>
<p class="warn"><b>Keep the exported file as it is.</b> Do not rename, move or delete files or folders inside the .zip, and do not edit <code>data.json</code>: the app finds every photo by its exact folder and file name. Each export also contains a <code>READ ME.txt</code> with these rules.</p>`
    );

  h += `<span id="imp"></span>`;
  if (!IMP) {
    h += `<p class="m">Choose one or more .zip files (or older .json backups). You will see what is inside and can tick what to import.</p><label class="b2">Choose files<input type="file" accept="${ACCEPT_IMP}" multiple hidden data-imp="1"></label>`;
    return h;
  }
  const notes = [];
  if (IMP.bad.length)
    notes.push(
      `Not a valid backup or export, skipped: ${esc(IMP.bad.join(", "))}`,
    );

  h +=
    `<p class="m">From: <b>${esc(IMP.names.join(", "))}</b></p>` +
    notes.map((n) => `<p class="err">${n}</p>`).join("") +
    missingHtml(IMP.missingList, false);
  if (!IMP.packs.length && !IMP.company) {
    return (
      h +
      `<div class="row"><button class="b2" data-a="iCancel">Choose other files</button></div>`
    );
  }
  if (IMP.full)
    h += `<div class="radios"><label><input type="radio" name="imode" value="replace"${IMP.mode == "replace" ? " checked" : ""}> Replace all current data with this backup</label><label><input type="radio" name="imode" value="merge"${IMP.mode == "merge" ? " checked" : ""}> Add only what I tick below to the current data</label></div>`;
  const merge = IMP.mode == "merge";
  h +=
    tree(treeNodes("i"), "i", IMP.sel, impGroup, !merge) ||
    `<p class="m">Nothing in the file matches the filter.</p>`;
  if (merge)
    h += `<p class="m">When an item already exists:</p><div class="radios"><label><input type="radio" name="iclash" value="replace"${IMP.clash == "replace" ? " checked" : ""}> Replace it with the imported one</label><label><input type="radio" name="iclash" value="keep"${IMP.clash == "keep" ? " checked" : ""}> Keep both (the imported one gets "(imported)")</label></div>`;
  return (
    h +
    `<div class="row" style="flex-wrap:wrap"><button class="b" data-a="iDo">${merge ? "Import selected" : "Replace all data"}</button><button class="b2" data-a="iCancel">Cancel</button></div>`
  );
}

async function exportSelected(btn) {
  const list = [
      ...S.lines.flatMap((l) =>
        l.products
          .filter((p) => EXS.has("p:" + p.id))
          .map((p) => ({
            p,
            kind: "product",
            line: l.name,
            dept: deptName(deptOf(p, S.co), S.co),
          })),
      ),
      ...S.machines
        .filter((m) => EXS.has("m:" + m.id))
        .map((p) => ({
          p,
          kind: "machine",
          line: "",
          dept: deptName(deptOf(p, S.co), S.co),
        })),
    ],
    co = EXS.has("co");
  if (!list.length && !co) return alert("Tick at least one thing to export.");
  if (allKeys("x").every((k) => EXS.has(k)))
    return exportZip(
      planBackup(backupState()),
      `setup-procedures-backup-${dateStamp()}.zip`,
      btn,
      () => {
        S.lastBackup = Date.now();
        save();
      },
    );
  const one = list.length == 1 && !co;
  exportZip(
    planItems(list, co ? { co: S.co, logo: S.logo } : null),
    one
      ? `${safeName(list[0].p.name, list[0].kind)} - ${list[0].kind} - ${dateStamp()}.zip`
      : `setup-procedures-export-${dateStamp()}.zip`,
    btn,
  );
}

let XTAB = "ex"; // Export & import page tab: "ex" or "im"
// Read the chosen files and show what is in them on the Export & import page.
async function loadImport(files) {
  document.body.style.cursor = "progress";
  const read = [];
  try {
    for (const f of files) read.push({ name: f.name, ...(await readFile(f)) });
  } finally {
    document.body.style.cursor = "";
  }
  const packs = [],
    bad = [],
    fulls = [];
  let company = null,
    missing = 0;
  const missingList = [];
  for (const r of read) {
    const c = fileContents(r.data);
    if (!c) {
      bad.push(r.name);
      continue;
    }
    packs.push(...c.packs.map((pk) => ({ ...pk, file: r.name })));
    if (c.company && !company) company = c.company;
    if (c.full) fulls.push(c.full);
    missing += r.missing;
    missingList.push(...r.missingList);
  }
  const full = read.length == 1 && fulls.length == 1 ? fulls[0] : null;
  IMP = {
    names: read.map((r) => r.name),
    packs,
    company,
    full,
    bad,
    missing,
    missingList,
    mode: full ? "replace" : "merge",
    clash: "replace",
    sel: new Set(),
  };
  allKeys("i").forEach((k) => IMP.sel.add(k));
  // Company details from a full backup are not ticked by default when adding.
  if (fulls.length) IMP.sel.delete("co");
  if (T != "x") EXS = new Set(allKeys("x"));
  XMSG = "";
  LASTMISS = [];
  T = "x";
  XTAB = "im";
  R(true);
  const el = $("#imp");
  if (el) el.scrollIntoView({ block: "start" });
}

async function applyImport() {
  let msg;
  if (IMP.mode == "replace" && IMP.full) {
    if (
      !confirm(
        "Replace ALL current data with this backup? You can undo this until you close or reload the page.",
      )
    )
      return;
    remember("All data replaced with the backup");
    const log = S.log,
      act = S.act;
    S = IMP.full;
    S.log = log || []; // the logs stay with this browser
    S.act = act || [];
    S.lastBackup = Date.now(); // this data is already in a backup file
    msg = "All data was replaced with the backup.";
    LASTMISS = IMP.missingList;
  } else {
    const chosen = IMP.packs.filter((_, i) => IMP.sel.has("i:" + i)),
      co = IMP.company && IMP.sel.has("co");
    if (!chosen.length && !co)
      return alert("Tick at least one thing to import.");
    remember(
      `Import of ${count(chosen.length, "item", "items")}${co ? " and company details" : ""}`,
    );
    if (co) mergeCompany(S, IMP.company);
    // Missing photos of the items (and logo) actually imported.
    const same = (m, pk) =>
      m.file == pk.file &&
      m.kind == pk.kind &&
      m.item == String(pk.item.name || "Untitled") &&
      (m.kind == "machine" || lineKey(m.line) == lineKey(pk.line));
    LASTMISS = IMP.missingList.filter((m) =>
      m.kind == "logo" ? co : chosen.some((pk) => same(m, pk)),
    );
    const res = chosen.map((pk) =>
        addItem(S, pk, () => IMP.clash == "replace"),
      ),
      rep = res.filter((r) => r.replaced).length;
    msg =
      [
        res.length - rep && `${count(res.length - rep, "item", "items")} added`,
        rep && `${rep} replaced`,
        co && "company details updated",
      ]
        .filter(Boolean)
        .join(", ") + ".";
    msg = msg[0].toUpperCase() + msg.slice(1);
  }
  // Finishing the company setup when importing from the Welcome screen.
  if (!S.co.done && S.co.name.trim()) {
    S.co.depts = S.co.depts.filter((d) => d.name.trim());
    S.co.done = true;
  }
  logAct("data", `Imported: ${msg}`);
  if (!(await writeNow())) return;
  IMP = null;
  XMSG = esc(msg);
  EXS = new Set(allKeys("x"));
  R();
}

async function dl(name, data) {
  try {
    const D = await claude.use("downloads");
    if (!D) throw 0;
    await D.save({ filename: name, data });
  } catch (e) {
    if (e && e.code == "declined") return;
    try {
      const u = URL.createObjectURL(
          data instanceof Blob ? data : new Blob([data]),
        ),
        a = document.createElement("a");
      a.href = u;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(u), 5000);
    } catch (x) {
      alert("Could not save the file.");
    }
  }
}
