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
  };
