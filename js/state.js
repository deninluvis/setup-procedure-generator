// App state, navigation, saving and per-browser view settings.
// Loaded after js/utils.js, js/storage.js and js/zip.js; the other app
// files (views, undo, transfer, pdf, events, app) use these globals.
const $ = (s) => document.querySelector(s);
// Screens: T = "co" company setup, "h" home, "p" products, "m" machines,
// "x" export & import.
let S = { lines: [], machines: [] },
  // Export & import page: tree grouping ("line" or "dept") and filter text
  GRP = "line",
  XF = "",
  HS = "", // home page search text
  HELPS = { x: false, item: false }, // help panels open? x = Export & import, item = product/machine page (closed at first)
  LASTMISS = [], // photos missing in the last import, shown with the result
  WM = false, // add a company/department watermark to downloaded PDFs
  PS = "medium", // photo size in the PDF: "small", "medium" or "large"
  V = { l: null, p: null },
  // Export & import page: export ticks, pending import, collapsed tree groups, result message
  EXS = new Set(),
  IMP = null,
  COL = new Set(),
  XMSG = "",
  T = "h",
  MID = null;
// Set up state from saved data (see the Store.load() call at the end).
function initState(data) {
  S = data && typeof data == "object" ? data : {};
  S.machines = S.machines || [];
  S.lines = S.lines || [];
  S.co = normCo(S.co);
  if (!S.co.done && !S.co.depts.length) S.co.depts = [{ id: id(), name: "" }];
  T = S.co.done ? "h" : "co";
}

// Saving: every change is saved straight away (photos are stored separately,
// so a save is small). If a save is still running, one more follows it.
// writeNow() saves at once and resolves false if storage is full.
let writing = null,
  dirty = false,
  fullShown = false;
const writeNow = async () => {
  try {
    await Store.write(S);
    fullShown = false;
    return true;
  } catch (e) {
    if (!fullShown)
      alert(
        "Storage is full, so the last change was not saved. Export a backup, then remove some photos or products.",
      );
    fullShown = true;
    return false;
  }
};
const save = () => {
  if (writing) {
    dirty = true;
    return;
  }
  writing = writeNow().finally(() => {
    writing = null;
    if (dirty) {
      dirty = false;
      save();
    }
  });
};
const BAD_IMG =
  "This image could not be read. Please use a PNG, JPG or SVG file. (iPhone HEIC photos may need converting first.)";
const L = () => S.lines.find((x) => x.id == V.l),
  P = () => {
    if (T == "m") return S.machines.find((x) => x.id == MID);
    const l = L();
    return l && l.products.find((x) => x.id == V.p);
  };

// ---------- View settings ----------
// "Group by" and collapsed groups on the Export & import page are remembered
// in this browser only (a convenience, not part of your data or backups).
const VIEW_KEY = "sp-view";
function loadView() {
  try {
    const v = JSON.parse(localStorage.getItem(VIEW_KEY) || "{}");
    if (v.grp == "line" || v.grp == "dept") GRP = v.grp;
    if (typeof v.help == "boolean") HELPS.x = v.help; // older setting
    if (typeof v.wm == "boolean") WM = v.wm;
    if (PHOTO_SIZES[v.ps]) PS = v.ps;
    if (v.helps && typeof v.helps == "object")
      for (const k in HELPS)
        if (typeof v.helps[k] == "boolean") HELPS[k] = v.helps[k];
    if (Array.isArray(v.col))
      COL = new Set(v.col.filter((x) => typeof x == "string").slice(0, 500));
  } catch (e) {}
}
function saveView() {
  try {
    localStorage.setItem(
      VIEW_KEY,
      JSON.stringify({ grp: GRP, col: [...COL], helps: HELPS, wm: WM, ps: PS }),
    );
  } catch (e) {}
}
