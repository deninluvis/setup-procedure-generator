// Pure helpers shared by app.js. Loaded as a classic script in the browser,
// and as a CommonJS module by the tests.

const id = () => Math.random().toString(36).slice(2, 9);
const esc = (s) =>
  String(s == null ? "" : s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
// Time in minutes from hours and minutes fields, or null when both are empty.
const toMinutes = (h, m) => {
  h = String(h ?? "").trim();
  m = String(m ?? "").trim();
  if (h === "" && m === "") return null;
  return Math.max(0, Math.round((+h || 0) * 60 + (+m || 0)));
};

// Format minutes as "1 h 30 min". Empty string for null.
const fmtTime = (mins) =>
  mins == null ? "" : `${Math.floor(mins / 60)} h ${mins % 60} min`;

// Format a byte count, e.g. 512 KB, 12.3 MB, 1.5 GB.
const fmtBytes = (n) =>
  n < 1024 * 1024
    ? Math.max(1, Math.round(n / 1024)) + " KB"
    : n < 1024 ** 3
      ? (n / 1024 ** 2).toFixed(1) + " MB"
      : (n / 1024 ** 3).toFixed(1) + " GB";

// Returns normalized {lines, machines, co, logo?} data from a parsed backup, or null if invalid.
const parseBackup = (j) => {
  if (!j || !Array.isArray(j.lines)) return null;
  const b = {
    lines: j.lines,
    machines: Array.isArray(j.machines) ? j.machines : [],
  };
  if (typeof j.logo == "string" && j.logo.startsWith("data:image/"))
    b.logo = j.logo;
  b.co = normCo(j.co);
  return b;
};

// Normalize company details to { name, depts: [{id, name}], done? }.
// Older data stored a single department as the string co.dept.
const normCo = (co) => {
  co = co && typeof co == "object" ? co : {};
  const out = { name: String(co.name ?? ""), depts: [] };
  if (Array.isArray(co.depts))
    out.depts = co.depts
      .filter((d) => d && typeof d == "object")
      .map((d) => ({ id: String(d.id || id()), name: String(d.name ?? "") }));
  else if (String(co.dept ?? "").trim())
    out.depts = [{ id: "d1", name: String(co.dept).trim() }];
  if (co.done && out.name.trim()) out.done = true;
  return out;
};

// Department id for a product/machine. Older items (no dept field) use the first one.
const deptOf = (p, co) =>
  p.dept === undefined ? (co.depts[0] || {}).id || "" : p.dept;

// Department name for an id, or "" when none or deleted.
const deptName = (deptId, co) =>
  (co.depts.find((d) => d.id == deptId) || {}).name || "";

// Copy of S with every image value passed through fn (product/machine photos,
// packaging/panel photos, step photos and the logo). test picks which values.
const mapImgs = (S, test, fn) => {
  const c = (v) => (test(v) ? fn(v) : v);
  const item = (p) => ({
    ...p,
    prod: (p.prod || []).map(c).filter(Boolean),
    pack: (p.pack || []).map(c).filter(Boolean),
    steps: (p.steps || []).map((s) => ({ ...s, img: c(s.img) || "" })),
  });
  const out = {
    ...S,
    lines: (S.lines || []).map((l) => ({
      ...l,
      products: (l.products || []).map(item),
    })),
    machines: (S.machines || []).map(item),
  };
  if (S.logo !== undefined) out.logo = c(S.logo) || undefined;
  if (out.logo === undefined) delete out.logo;
  return out;
};

// ---------- Backup and single-item export (ZIP) ----------

// Local date as YYYY-MM-DD, for file names.
const dateStamp = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Name that is safe as a file or folder name on Windows, macOS and Linux.
const safeName = (s, fallback) =>
  String(s || "")
    .replace(/[\\/:*?"<>|\x00-\x1f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "")
    .replace(/[. ]+$/, "")
    .slice(0, 60) || fallback;

// File extension for image data, e.g. "jpg" or "png".
const imgExt = (dataUrl) => {
  const m = /^data:image\/([a-z0-9]+)/i.exec(dataUrl || ""),
    t = m ? m[1].toLowerCase() : "jpg";
  return t == "jpeg" ? "jpg" : t;
};

const isImgData = (v) => typeof v == "string" && v.startsWith("data:image/");
// In a ZIP's data.json, an image is a file path instead of image data.
const isImgPath = (v) =>
  typeof v == "string" && v !== "" && !v.startsWith("data:");

// Assigns readable, unique file paths to images. Same image -> same file.
const imgPlanner = () => {
  const files = [],
    used = new Set(),
    byData = new Map();
  const folder = (f) => {
    let q = f,
      n = 2;
    while (used.has(q.toLowerCase())) q = `${f} (${n++})`;
    used.add(q.toLowerCase());
    return q;
  };
  const put = (v, path) => {
    if (!isImgData(v)) return v;
    if (byData.has(v)) return byData.get(v);
    const p = `${path}.${imgExt(v)}`;
    files.push([p, v]);
    byData.set(v, p);
    return p;
  };
  // kinds: names for the two photo groups, e.g. ["product", "packaging"]
  const item = (p, path, kinds) => {
    const f = folder(path);
    return {
      ...p,
      prod: (p.prod || []).map((v, i) => put(v, `${f}/${kinds[0]}-${i + 1}`)),
      pack: (p.pack || []).map((v, i) => put(v, `${f}/${kinds[1]}-${i + 1}`)),
      steps: (p.steps || []).map((s, i) => ({
        ...s,
        img: put(s.img, `${f}/step-${i + 1}`),
      })),
    };
  };
  return { files, put, item };
};
const PROD_KINDS = ["product", "packaging"],
  MACH_KINDS = ["machine", "panel"];

// Full backup -> { data, files }. data goes in data.json with image paths;
// files is [[path, imageData]] for the photos/ folder and the logo.
const planBackup = (S) => {
  const pl = imgPlanner(),
    data = {
      format: "setup-procedures-backup",
      version: 2,
      exported: dateStamp(),
      ...S,
      lines: (S.lines || []).map((l) => ({
        ...l,
        products: (l.products || []).map((p) =>
          pl.item(
            p,
            `photos/${safeName(l.name, "Line")}/${safeName(p.name, "Product")}`,
            PROD_KINDS,
          ),
        ),
      })),
      machines: (S.machines || []).map((m) =>
        pl.item(
          m,
          `photos/Machines/${safeName(m.name, "Machine")}`,
          MACH_KINDS,
        ),
      ),
    };
  if (S.logo) data.logo = pl.put(S.logo, "logo");
  else delete data.logo;
  return { data, files: pl.files };
};

// Products and machines -> { data, files }, to share with another app.
// list: [{ p, kind: "product" | "machine", line, dept }] (line and dept are names).
// company: optional { co, logo } to include company name, departments and logo.
const planItems = (list, company) => {
  const pl = imgPlanner();
  const data = {
    format: "setup-procedures-items",
    version: 1,
    exported: dateStamp(),
    items: list.map(({ p, kind, line, dept }) => ({
      kind,
      line: line || "",
      dept: dept || "",
      item:
        kind == "machine"
          ? pl.item(
              p,
              `photos/Machines/${safeName(p.name, "Machine")}`,
              MACH_KINDS,
            )
          : pl.item(
              p,
              `photos/${safeName(line, "Products")}/${safeName(p.name, "Product")}`,
              PROD_KINDS,
            ),
    })),
  };
  if (company) {
    data.company = {
      name: company.co.name,
      depts: company.co.depts.map((d) => d.name).filter((n) => n.trim()),
    };
    if (company.logo) data.company.logo = pl.put(company.logo, "logo");
  }
  return { data, files: pl.files };
};

const ITEM_FORMATS = ["setup-procedures-item", "setup-procedures-items"];

// Items in a shared file as [{ kind, line, dept, item }], or null if the file
// is not a product/machine export. Reads both the list format and the older
// single-item format.
const itemPacks = (data) => {
  if (!data || typeof data != "object") return null;
  const ok = (x) => x && x.item && typeof x.item == "object";
  const norm = (x) => ({
    ...x,
    kind: x.kind == "machine" ? "machine" : "product",
  });
  if (data.format == "setup-procedures-item")
    return ok(data) ? [norm(data)] : null;
  if (data.format == "setup-procedures-items" && Array.isArray(data.items)) {
    const items = data.items.filter(ok).map(norm);
    return items.length ? items : null;
  }
  return null;
};

// Every product and machine in a department, or in a product line, ready for planItems().
const itemsWhere = (S, keep) =>
  [
    ...S.lines.flatMap((l) =>
      l.products.map((p) => ({
        p,
        kind: "product",
        line: l.name,
        dept: deptName(deptOf(p, S.co), S.co),
      })),
    ),
    ...S.machines.map((p) => ({
      p,
      kind: "machine",
      line: "",
      dept: deptName(deptOf(p, S.co), S.co),
    })),
  ].filter(keep);
const deptItems = (S, deptId) =>
  itemsWhere(S, (x) => deptOf(x.p, S.co) == deptId);
const lineItems = (S, lineId) => {
  const l = S.lines.find((x) => x.id == lineId);
  return l
    ? itemsWhere(S, (x) => x.kind == "product" && l.products.includes(x.p))
    : [];
};

// Image fields of a whole backup, or of each item (and company logo) in a
// shared file, through fn.
const mapFileImgs = (data, test, fn) => {
  if (!ITEM_FORMATS.includes(data.format)) return mapImgs(data, test, fn);
  const packs = itemPacks(data) || [],
    items = mapImgs({ machines: packs.map((x) => x.item) }, test, fn).machines,
    out =
      data.format == "setup-procedures-item"
        ? { ...data, item: items[0] }
        : {
            ...data,
            items: (data.items || [])
              .filter((x) => x && x.item)
              .map((x, i) => ({ ...x, item: items[i] })),
          };
  if (data.company && data.company.logo !== undefined) {
    const logo = mapImgs({ logo: data.company.logo }, test, fn).logo;
    out.company = { ...data.company };
    if (logo) out.company.logo = logo;
    else delete out.company.logo;
  }
  return out;
};

// The image paths a data.json refers to.
const imgPaths = (data) => {
  const want = new Set();
  if (data) mapFileImgs(data, isImgPath, (v) => (want.add(v), v));
  return want;
};

// Put image data back in place of paths. imgs: Map(path -> imageData).
// Returns { data, missing } where missing counts images not found.
const restoreImgs = (data, imgs) => {
  let missing = 0;
  const out = mapFileImgs(data, isImgPath, (v) => {
    const d = imgs.get(v);
    if (!d) missing++;
    return d || "";
  });
  return { data: out, missing };
};

// Backup reminder: whole days since a time, and whether a backup is due.
const DAY = 24 * 60 * 60 * 1000;
const daysSince = (ts, now = Date.now()) => {
  const a = new Date(ts),
    b = new Date(now);
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  return Math.round((b - a) / DAY);
};
const agoText = (ts, now = Date.now()) => {
  if (!ts) return "never";
  const d = daysSince(ts, now);
  return d <= 0 ? "today" : d == 1 ? "yesterday" : `${d} days ago`;
};
const hasItems = (S) =>
  S.machines.length > 0 || S.lines.some((l) => l.products.length > 0);
const backupDue = (S, now = Date.now(), days = 7) =>
  hasItems(S) && (!S.lastBackup || daysSince(S.lastBackup, now) >= days);

// ---------- Universal import ----------

// Every product and machine of a backup as packs, like a shared file has.
const backupPacks = (b) => [
  ...b.lines.flatMap((l) =>
    (l.products || []).map((p) => ({
      kind: "product",
      line: l.name,
      dept: deptName(deptOf(p, b.co), b.co),
      item: p,
    })),
  ),
  ...b.machines.map((p) => ({
    kind: "machine",
    line: "",
    dept: deptName(deptOf(p, b.co), b.co),
    item: p,
  })),
];

// What an imported file holds: { packs, company, full } or null if not valid.
// full is the whole backup (for "replace everything"); company is
// { name, depts: [names], logo? } or null.
const fileContents = (data) => {
  if (!data || typeof data != "object") return null;
  if (ITEM_FORMATS.includes(data.format)) {
    const packs = itemPacks(data) || [],
      c = data.company && typeof data.company == "object" ? data.company : null,
      company = c
        ? {
            name: String(c.name || ""),
            depts: (Array.isArray(c.depts) ? c.depts : []).map(String),
            logo: c.logo || undefined,
          }
        : null;
    return packs.length || company ? { packs, company, full: null } : null;
  }
  const b = parseBackup(data);
  if (!b) return null;
  return {
    packs: backupPacks(b),
    company: {
      name: b.co.name,
      depts: b.co.depts.map((d) => d.name).filter((n) => n.trim()),
      logo: b.logo,
    },
    full: b,
  };
};

// Does a product/machine with this name already exist where it would go?
const findExisting = (S, pk) => {
  const name = String(pk.item.name || "")
      .trim()
      .toLowerCase(),
    same = (x) =>
      String(x.name || "")
        .trim()
        .toLowerCase() == name;
  if (pk.kind == "machine") return S.machines.some(same);
  const ln = (String(pk.line || "").trim() || "Imported").toLowerCase(),
    l = S.lines.find((x) => x.name.trim().toLowerCase() == ln);
  return !!l && l.products.some(same);
};

// Apply imported company details: name and logo (when given) replace the
// current ones; departments that are missing are added.
const mergeCompany = (S, c) => {
  if (c.name && c.name.trim()) S.co.name = c.name;
  if (c.logo) S.logo = c.logo;
  for (const n of c.depts || []) {
    if (
      n.trim() &&
      !S.co.depts.some(
        (d) => d.name.trim().toLowerCase() == n.trim().toLowerCase(),
      )
    )
      S.co.depts.push({ id: id(), name: n.trim() });
  }
};

// Add an imported product or machine to S (changes S). The department and
// product line are matched by name and created if missing. If an item with
// the same name exists there, replace(name, where) decides: true replaces it,
// false keeps both (the new one gets " (imported)").
// Returns { kind, lineId, item, replaced }.
const addItem = (S, pk, replace) => {
  const it = { ...pk.item, id: id() };
  const dn = String(pk.dept || "").trim();
  it.dept = "";
  if (dn) {
    let d = S.co.depts.find(
      (x) => x.name.trim().toLowerCase() == dn.toLowerCase(),
    );
    if (!d) S.co.depts.push((d = { id: id(), name: dn }));
    it.dept = d.id;
  }
  let list,
    where,
    lineId = null;
  if (pk.kind == "machine") {
    list = S.machines;
    where = "Machines";
  } else {
    const ln = String(pk.line || "").trim() || "Imported";
    let l = S.lines.find(
      (x) => x.name.trim().toLowerCase() == ln.toLowerCase(),
    );
    if (!l) S.lines.push((l = { id: id(), name: ln, products: [] }));
    list = l.products;
    where = l.name;
    lineId = l.id;
  }
  const name = String(it.name || "")
      .trim()
      .toLowerCase(),
    i = list.findIndex(
      (x) =>
        String(x.name || "")
          .trim()
          .toLowerCase() == name,
    );
  if (i >= 0 && replace(it.name, where)) {
    it.id = list[i].id;
    list[i] = it;
    return { kind: pk.kind, lineId, item: it, replaced: true };
  }
  if (i >= 0) {
    // Keep both: give the new one a name not used yet in this list.
    const base = it.name,
      used = (n) =>
        list.some(
          (x) =>
            String(x.name || "")
              .trim()
              .toLowerCase() == n.toLowerCase(),
        );
    let n = 1;
    do it.name = base + (n == 1 ? " (imported)" : ` (imported ${n})`);
    while (used(it.name) && ++n);
  }
  list.push(it);
  return { kind: pk.kind, lineId, item: it, replaced: false };
};

if (typeof module !== "undefined")
  module.exports = {
    id,
    esc,
    parseBackup,
    toMinutes,
    fmtTime,
    normCo,
    deptOf,
    deptName,
    fmtBytes,
    mapImgs,
    dateStamp,
    safeName,
    imgExt,
    planBackup,
    planItems,
    fileContents,
    findExisting,
    mergeCompany,
    backupPacks,
    itemPacks,
    deptItems,
    lineItems,
    daysSince,
    agoText,
    backupDue,
    imgPaths,
    restoreImgs,
    addItem,
  };
