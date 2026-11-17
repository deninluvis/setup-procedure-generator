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
    steps: (p.steps || []).map((s) => ({
      ...s,
      img: c(s.img) || "",
      ...(Array.isArray(s.subs)
        ? { subs: s.subs.map((u) => ({ ...u, img: c(u.img) || "" })) }
        : {}),
    })),
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
        ...(Array.isArray(s.subs)
          ? {
              subs: s.subs.map((u, j) => ({
                ...u,
                img: put(u.img, `${f}/step-${i + 1}-${j + 1}`),
              })),
            }
          : {}),
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

// Every photo a data.json refers to, with where it belongs, so a missing one
// can be reported clearly: [{ path, item, kind, line, what }].
// kind is "product", "machine" or "logo".
const imgRefs = (data) => {
  const out = [];
  if (!data || typeof data != "object") return out;
  const walk = (p, kind, line) => {
    if (!p || typeof p != "object") return;
    const [a, b] =
        kind == "machine"
          ? ["Machine photo", "Control panel photo"]
          : ["Product photo", "Packaging photo"],
      add = (v, what) =>
        isImgPath(v) &&
        out.push({
          path: v,
          item: String(p.name || "Untitled"),
          kind,
          line: line || "",
          what,
        });
    (p.prod || []).forEach((v, i) => add(v, `${a} ${i + 1}`));
    (p.pack || []).forEach((v, i) => add(v, `${b} ${i + 1}`));
    (p.steps || []).forEach((s, i) => {
      if (!s) return;
      add(s.img, `Step ${i + 1} photo`);
      (Array.isArray(s.subs) ? s.subs : []).forEach(
        (u, j) => u && add(u.img, `Step ${i + 1}.${j + 1} photo`),
      );
    });
  };
  const logo = (v) =>
    isImgPath(v) &&
    out.push({
      path: v,
      item: "Company logo",
      kind: "logo",
      line: "",
      what: "Logo",
    });
  if (ITEM_FORMATS.includes(data.format)) {
    (itemPacks(data) || []).forEach((pk) =>
      walk(
        pk.item,
        pk.kind,
        pk.kind == "product" ? String(pk.line || "").trim() || "Imported" : "",
      ),
    );
    if (data.company) logo(data.company.logo);
  } else {
    (data.lines || []).forEach((l) =>
      (l.products || []).forEach((p) => walk(p, "product", l.name)),
    );
    (data.machines || []).forEach((m) => walk(m, "machine", ""));
    logo(data.logo);
  }
  return out;
};

// A file in the ZIP whose name is close to a missing one: same name in another
// letter case or with another image extension, or the same file name in
// another folder. Returns its path, or "".
const similarPath = (path, names) => {
  const base = (p) =>
      p
        .toLowerCase()
        .replace(/\.(jpe?g|png|webp|gif|heic|heif|bmp|tiff?|svg)$/, ""),
    want = base(path),
    file = path.split("/").pop().toLowerCase();
  return (
    names.find((n) => n != path && base(n) == want) ||
    names.find((n) => n != path && n.split("/").pop().toLowerCase() == file) ||
    ""
  );
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

// ---------- Access codes ----------
// SHA-256 of a text, as 64 hex characters. Plain JavaScript, so it also works
// when the app is opened as a file (where crypto.subtle may be missing).
function sha256(text) {
  const K = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
      0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
      0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
      0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
      0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
      0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
      0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
      0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
      0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
    ],
    H0 = [
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
      0x1f83d9ab, 0x5be0cd19,
    ],
    bytes = [...new TextEncoder().encode(text)],
    bits = bytes.length * 8;
  let H = H0;
  bytes.push(0x80);
  while (bytes.length % 64 != 56) bytes.push(0);
  for (let i = 7; i >= 0; i--)
    bytes.push(Math.floor(bits / 2 ** (i * 8)) & 255);
  const rot = (x, n) => (x >>> n) | (x << (32 - n)),
    w = new Array(64);
  for (let o = 0; o < bytes.length; o += 64) {
    for (let i = 0; i < 16; i++)
      w[i] =
        (bytes[o + i * 4] << 24) |
        (bytes[o + i * 4 + 1] << 16) |
        (bytes[o + i * 4 + 2] << 8) |
        bytes[o + i * 4 + 3];
    for (let i = 16; i < 64; i++) {
      const s0 = rot(w[i - 15], 7) ^ rot(w[i - 15], 18) ^ (w[i - 15] >>> 3),
        s1 = rot(w[i - 2], 17) ^ rot(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 =
          (h +
            (rot(e, 6) ^ rot(e, 11) ^ rot(e, 25)) +
            ((e & f) ^ (~e & g)) +
            K[i] +
            w[i]) |
          0,
        t2 =
          ((rot(a, 2) ^ rot(a, 13) ^ rot(a, 22)) +
            ((a & b) ^ (a & c) ^ (b & c))) |
          0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }
    H = H.map((x, i) => (x + [a, b, c, d, e, f, g, h][i]) | 0);
  }
  return H.map((x) => (x >>> 0).toString(16).padStart(8, "0")).join("");
}

// Access codes ignore case, spaces and dashes: "ab12-cd34" = "AB12 CD34".
const normCode = (c) =>
  String(c || "")
    .toUpperCase()
    .replace(/[\s-]+/g, "");
// What is stored in js/access.js: the scrambled code, never the code itself.
const codeHash = (c) => sha256("setup-procedures-access:" + normCode(c));

// Reference printed on PDFs: the first 6 characters of the scrambled code.
// It shows which access code made a PDF without revealing the code.
const codeRef = (hash) =>
  String(hash || "")
    .slice(0, 6)
    .toUpperCase();

// Tracking dots: the reference as 28 bits = 6 hex digits (4 bits each, most
// significant first) + a check digit (sum of the digits, mod 16).
const refBits = (ref) => {
  const digits = [...String(ref).toUpperCase()].map((c) => parseInt(c, 16));
  if (digits.length != 6 || digits.some(isNaN)) return [];
  digits.push(digits.reduce((a, b) => a + b, 0) % 16);
  return digits.flatMap((v) => [8, 4, 2, 1].map((m) => (v & m ? 1 : 0)));
};
// Back from 28 bits (or a text of 0s and 1s, spaces ignored) to the
// reference; "" if the count or the check digit is wrong.
const bitsRef = (bits) => {
  const b = typeof bits == "string" ? [...bits.replace(/\s+/g, "")] : bits;
  if (b.length != 28 || b.some((x) => x != 0 && x != 1)) return "";
  const v = [];
  for (let i = 0; i < 28; i += 4)
    v.push(b.slice(i, i + 4).reduce((a, x) => a * 2 + +x, 0));
  const check = v.pop();
  if (v.reduce((a, x) => a + x, 0) % 16 != check) return "";
  return v.map((x) => x.toString(16).toUpperCase()).join("");
};

// ---------- Approvals ----------
// An approver code is turned into an Ed25519 signing key: only the matching
// public key is listed in js/approvers.js. An approval file is signed with it,
// so it cannot be made or changed without the code. Uses the built-in Web
// Crypto (browser and Node); crypto.subtle is null where it is missing.
const subtle = () =>
  (typeof globalThis != "undefined" &&
    globalThis.crypto &&
    globalThis.crypto.subtle) ||
  null;
const hexToBytes = (h) =>
  new Uint8Array((String(h).match(/../g) || []).map((x) => parseInt(x, 16)));
const bytesToHex = (b) =>
  [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const b64urlToBytes = (s) => {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};
// JSON with keys in a fixed order, so the same data always gives the same text.
const stableJson = (v) =>
  Array.isArray(v)
    ? "[" + v.map(stableJson).join(",") + "]"
    : v && typeof v == "object"
      ? "{" +
        Object.keys(v)
          .filter((k) => v[k] !== undefined)
          .sort()
          .map((k) => JSON.stringify(k) + ":" + stableJson(v[k]))
          .join(",") +
        "}"
      : JSON.stringify(v === undefined ? null : v);

// What an approval covers: everything printed in the procedure (photos as a
// hash of their bytes, from imgHash), but not "Approved by" or the approval
// itself. kind = "product" / "machine"; dept = department name.
const apContent = (p, kind, dept, imgHash) => {
  const s = (x) => String(x ?? "").trim(),
    img = (x) => (x ? imgHash(x) : ""),
    note = (o) =>
      o.warn === undefined
        ? {}
        : { warn: s(o.warn), wtype: s(o.wtype) || "warning" };
  return {
    kind,
    dept: s(dept),
    name: s(p.name),
    code: s(p.code),
    rev: s(p.rev),
    date: s(p.date),
    prod: (p.prod || []).map(img),
    pack: (p.pack || []).map(img),
    ppe: (p.ppe || []).map(s),
    ppeo: s(p.ppeo),
    tools: (p.tools || [])
      .filter((t) => s(t.n))
      .map((t) => ({ n: s(t.n), s: s(t.s), q: s(t.q) })),
    steps: (p.steps || []).map((st) => ({
      h: s(st.h),
      t: s(st.t),
      img: img(st.img),
      ...note(st),
      subs: (st.subs || []).map((u) => ({
        t: s(u.t),
        img: img(u.img),
        ...note(u),
      })),
    })),
    th: s(p.th),
    tm: s(p.tm),
    tech: s(p.tech),
    by: s(p.by),
  };
};
// Images in an item (data URLs), for hashing before apContent.
const apImages = (p) =>
  [
    ...(p.prod || []),
    ...(p.pack || []),
    ...(p.steps || []).flatMap((st) => [
      st.img,
      ...(st.subs || []).map((u) => u.img),
    ]),
  ].filter(Boolean);
// SHA-256 of an image's bytes (the part after "base64,"), as hex.
const imgDigest = async (dataUrl) => {
  const b64 = String(dataUrl).slice(String(dataUrl).indexOf(",") + 1);
  return bytesToHex(
    await subtle().digest("SHA-256", new TextEncoder().encode(b64)),
  );
};
// Fingerprint of an item's content. cache: optional Map(dataUrl -> hash).
async function apFingerprint(p, kind, dept, cache = new Map()) {
  for (const x of apImages(p))
    if (!cache.has(x)) cache.set(x, await imgDigest(x));
  return sha256(stableJson(apContent(p, kind, dept, (x) => cache.get(x))));
}

const ED_PKCS8 = "302e020100300506032b657004220420";
// Signing key and public key (hex) for an approver code.
async function apKeys(code) {
  const seed = sha256("setup-procedures-approver:" + normCode(code)),
    priv = await subtle().importKey(
      "pkcs8",
      hexToBytes(ED_PKCS8 + seed),
      { name: "Ed25519" },
      true,
      ["sign"],
    ),
    jwk = await subtle().exportKey("jwk", priv);
  return { priv, pub: bytesToHex(b64urlToBytes(jwk.x)) };
}
const apSign = async (priv, payload) =>
  bytesToHex(
    await subtle().sign(
      { name: "Ed25519" },
      priv,
      new TextEncoder().encode(stableJson(payload)),
    ),
  );
async function apVerify(pub, payload, sig) {
  try {
    const key = await subtle().importKey(
      "raw",
      hexToBytes(pub),
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    return await subtle().verify(
      { name: "Ed25519" },
      key,
      hexToBytes(sig),
      new TextEncoder().encode(stableJson(payload)),
    );
  } catch (e) {
    return false;
  }
}
// Check an approval file against the approvers list ([[name, pub]]).
// -> { ok, why, name, slot, payload }
async function apCheck(file, approvers) {
  if (
    !file ||
    file.format != "setup-procedures-approval" ||
    !file.payload ||
    typeof file.pub != "string" ||
    typeof file.sig != "string"
  )
    return { ok: false, why: "This is not an approval file." };
  const a = approvers.find((x) => x[1] === file.pub);
  if (!a)
    return {
      ok: false,
      why: "This approval was signed with an approver code that is not (or no longer) on the list of approvers.",
    };
  if (!(await apVerify(file.pub, file.payload, file.sig)))
    return {
      ok: false,
      why: "This approval file has been changed since it was signed, so it cannot be trusted.",
    };
  // name: the name the approver typed when signing (signed with the decision);
  // slot: the approver code's name in the list (e.g. "Approver 1").
  const typed = String(file.payload.signer || "").trim();
  return { ok: true, name: typed || a[0], slot: a[0], payload: file.payload };
}

if (typeof module !== "undefined")
  module.exports = {
    stableJson,
    apContent,
    apImages,
    apFingerprint,
    apKeys,
    apSign,
    apVerify,
    apCheck,
    bytesToHex,
    refBits,
    bitsRef,
    codeRef,
    sha256,
    normCode,
    codeHash,
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
    imgRefs,
    similarPath,
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
