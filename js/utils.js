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

// One product or machine -> { data, files }, to share with another app.
const planItem = (p, kind, lineName, dept) => {
  const pl = imgPlanner();
  return {
    data: {
      format: "setup-procedures-item",
      version: 1,
      exported: dateStamp(),
      kind,
      line: lineName || "",
      dept: dept || "",
      item: pl.item(
        p,
        `photos/${safeName(p.name, kind == "machine" ? "Machine" : "Product")}`,
        kind == "machine" ? MACH_KINDS : PROD_KINDS,
      ),
    },
    files: pl.files,
  };
};

// The image paths a data.json refers to.
const imgPaths = (data) => {
  const want = new Set(),
    add = (v) => (want.add(v), v);
  if (data && data.format == "setup-procedures-item")
    mapImgs({ machines: [data.item || {}] }, isImgPath, add);
  else if (data) mapImgs(data, isImgPath, add);
  return want;
};

// Put image data back in place of paths. imgs: Map(path -> imageData).
// Returns { data, missing } where missing counts images not found.
const restoreImgs = (data, imgs) => {
  let missing = 0;
  const get = (v) => {
    const d = imgs.get(v);
    if (!d) missing++;
    return d || "";
  };
  const out =
    data.format == "setup-procedures-item"
      ? {
          ...data,
          item: mapImgs({ machines: [data.item || {}] }, isImgPath, get)
            .machines[0],
        }
      : mapImgs(data, isImgPath, get);
  return { data: out, missing };
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
  if (i >= 0) it.name += " (imported)";
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
    planItem,
    imgPaths,
    restoreImgs,
    addItem,
  };
