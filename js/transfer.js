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
      s.img,
      ...(s.subs || []).map((u) => u.img),
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
const lineKey = (n) => (String(n || "").trim() || "Imported").toLowerCase();
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
    const id = e.target.dataset && e.target.dataset.help;
    if (id && id in HELPS) {
      HELPS[id] = e.target.open;
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
const xHelp = () =>
  helpBox(
    "x",
    "How export and import work",
    `<h3>Export: save or share</h3>
<ol>
<li>Tick what you want in the <b>Export</b> list below. Ticking a group ticks everything in it. Use <b>Group by</b> to list by product line or by department, and the <b>filter</b> box to find items.</li>
<li>Press the button under the list:
<ul>
<li><b>Everything ticked → Export full backup.</b> A complete copy of all your data, named <code>setup-procedures-backup-DATE.zip</code>. Keep it somewhere safe, such as a USB drive or a company network folder.</li>
<li><b>Some items ticked → Export selected.</b> A file with just those items, to share with a colleague.</li>
</ul></li>
<li>The <code>.zip</code> file downloads. Inside are <code>data.json</code> (all the text), your photos as normal image files in folders named after your lines, products and machines, and a <code>READ ME.txt</code>.</li>
</ol>
<h3>Keep the export file as it is</h3>
<ul>${KEEP_RULES.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>
<p><b>The only safe change: replacing a photo.</b> Save the new photo with <b>exactly the same file name, in the same folder</b>, over the old one. If you unzip the file to do that, zip it again with <code>data.json</code> and the <code>photos</code> folder inside, keeping every folder as it was. If something goes wrong, import the original file you exported.</p>
<h3>Import: restore or add</h3>
<ol>
<li>Under <b>Import</b>, press <b>Choose files</b> and pick one or more <code>.zip</code> files. Older <code>.json</code> backups work too.</li>
<li>Check the list of what is inside. Each item is marked <span class="bd new">new</span> or <span class="bd">already exists</span>. If any photos are missing, the page lists each one: which product or machine, which photo, and the exact file name it looked for.</li>
<li>For a <b>full backup</b>, choose <b>Replace all current data</b> (restore everything, for example on a new computer) or <b>Add only what I tick</b>.</li>
<li>Tick what to import. For items that already exist, choose <b>Replace it</b> or <b>Keep both</b>.</li>
<li>Press <b>Import selected</b> (or <b>Replace all data</b>). A message confirms what was imported.</li>
</ol>
<h3>Good to know</h3>
<ul>
<li>Your data is stored only in this browser. Export a full backup regularly; the home page reminds you after 7 days.</li>
<li><b>Moving to another computer or browser:</b> export a full backup here. On the other one, press <b>Import backup</b> on the Welcome screen, choose the file and keep <b>Replace all current data</b>.</li>
<li>Imported products go into the product line with the same name. Missing lines and departments are created.</li>
<li>Company details and logo change only if you tick them when importing.</li>
<li>Nothing changes until you press the import button. <b>Cancel</b> leaves everything as it was.</li>
</ul>`,
  );

// Help at the top of a product or machine page.
const itemHelp = (mm) => {
  const it = mm ? "machine" : "product";
  return helpBox(
    "item",
    `How to fill in this ${it}`,
    `<ol>
<li><b>Details.</b> Enter the ${it} name, pick the <b>Department</b>, and fill in the ${mm ? "machine ID / asset number" : "product code"}. Raise the <b>Revision</b> number whenever you change the procedure, so printed copies can be told apart.</li>
<li><b>Photos.</b> Under <b>${mm ? "Machine photos" : "Product photos"}</b> and <b>${mm ? "Control panel / nameplate photos" : "Packaging photos"}</b>, press <b>＋ Add photo</b>. You can pick several at once. Photos are kept in high quality so they can be zoomed in the PDF. <b>✕</b> on a photo removes it. <b>✎</b> (or <b>✎ Mark up</b> on a step photo) lets you draw arrows, circles and numbers on it to point at the exact part.</li>
<li><b>Approval.</b> The box at the top shows whether this is a <b>Draft</b>, <b>Waiting for approval</b>, <b>Approved</b> or <b>Rejected</b>. Drafts print with a DRAFT watermark. Press <b>Request approval</b>, choose the approver and their email, then attach the saved file to the email that opens. When the approver's file comes back, press <b>Import approval file</b>. Any change after approval makes it a draft again.</li>
<li><b>Safety equipment (PPE).</b> Tick what must be worn, such as safety glasses or gloves. Each one prints as a safety sign at the top of the PDF. Anything else goes in <b>Other safety equipment</b>.</li>
<li><b>Tools required.</b> Press <b>＋ Add tool</b> and enter the tool, its size or specification and the quantity. Press Enter to add the next one. Tool names you used before are suggested. In the PDF they print as a checklist with a box to tick before the procedure.</li>
<li><b>Steps.</b> Write one step per action, in order:
<ul>
<li>A short <b>headline</b> (optional) is printed in bold, for example "Install the fixture".</li>
<li>The <b>description</b> says exactly what to do, with values such as torque, speed or program number.</li>
<li><b>＋ Add photo</b> adds one photo to the step, for example the part or the control panel.</li>
<li><b>↑ ↓</b> move a step up or down, and <b>✕</b> deletes it.</li>
<li><b>＋ Insert step below</b> adds a new step right after that step; <b>＋ Add step</b> at the bottom adds one at the end. Steps renumber automatically.</li>
<li><b>⚠ Add warning or note</b> on a step or sub-step adds a box. Choose its type: <b>Warning</b> (serious hazard, red), <b>Caution</b> (risk of damage, orange) or <b>Note</b> (useful tip, blue), then describe it. In the PDF it prints in a box with the same colour edge, a symbol and the word WARNING, CAUTION or NOTE next to it. <b>✕</b> in the box removes it.</li>
<li><b>＋ Add sub-step</b> adds numbered sub-steps (3.1, 3.2, …) inside a step, each with its own text and optional photo. They print indented under their step.</li>
</ul></li>
<li><b>Sign-off.</b> Fill in <b>Time required</b> (hours and minutes) and <b>Technicians required</b>, or leave them empty to write them in by pen on the printed PDF. <b>Prepared by</b> and <b>Approved by</b> are needed to download the PDF.</li>
<li><b>Download PDF.</b> Tick <b>Add watermark</b> first if you want the company name and department printed faintly across every page, and pick the <b>Photo size in the PDF</b> (Small, Medium or Large; photos stay sharp when zoomed at any size). The PDF has your logo, company and department at the top, the photos, every step with its photo kept on one page, and the approval table with signature lines at the end.</li>
</ol>
<h3>Good to know</h3>
<ul>
<li>Everything is saved automatically as you type. There is no Save button.</li>
<li><b>Removed something by mistake?</b> Press <b>Undo</b> in the bar at the bottom of the screen, or Ctrl+Z (⌘Z on a Mac) when you are not typing in a field. This works for steps, sub-steps, warnings and notes, photos, products, machines, lines, departments, the logo, imports and clearing all data, until you close or reload the page.</li>
<li><b>Export this ${it}</b> makes a file to share this one ${it} with a colleague (see <b>Export &amp; import</b> on the home page).</li>
<li><b>Delete ${it}</b> removes it for good. Export it or make a backup first if you might need it again.</li>
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
    `<div class="xbar"><input type="search" data-xf="1" value="${esc(XF)}" placeholder="Filter by name, code, line or department" aria-label="Filter the lists"><div class="radios seg" role="radiogroup" aria-label="Group by"><span class="m">Group by</span><label><input type="radio" name="grp" value="line"${GRP == "line" ? " checked" : ""}> Product line</label><label><input type="radio" name="grp" value="dept"${GRP == "dept" ? " checked" : ""}> Department</label></div></div>` +
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
    `<button class="lk" data-a="goHome">← Home</button><h1>Export &amp; import</h1>` +
    xHelp() +
    (XMSG
      ? `<p class="ok" role="status">${XMSG}</p>` + missingHtml(LASTMISS, true)
      : "") +
    `<h2>Export</h2><p class="m">Tick what to export. With everything ticked you get a full backup.</p>` +
    toolbar() +
    (tree(treeNodes("x"), "x", EXS, exGroup, false) ||
      `<p class="m">Nothing matches the filter.</p>`) +
    `<p class="m" role="status">${picked.length ? `Selected: ${picked.join(", ")}${all ? " (full backup)" : ""} · about ${fmtBytes(bytes + 2048)}` : "Nothing selected."}</p>
<div class="row"><button class="b" data-a="xExport"${picked.length ? "" : " disabled"}>${all ? "Export full backup" : "Export selected"}</button></div>
<p class="warn"><b>Keep the exported file as it is.</b> Do not rename, move or delete files or folders inside the .zip, and do not edit <code>data.json</code>: the app finds every photo by its exact folder and file name. Each export also contains a <code>READ ME.txt</code> with these rules.</p>`;

  h += `<h2 id="imp">Import</h2>`;
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
      planBackup(S),
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
    S = IMP.full;
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
