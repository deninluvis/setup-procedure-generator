// Pure helpers shared by app.js. Loaded as a classic script in the browser,
// and as a CommonJS module by the tests.

const id = () => Math.random().toString(36).slice(2, 9);
const esc = (s) =>
  String(s == null ? "" : s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
// Staffing row time in minutes, or null when both hours and minutes are empty.
const rowMinutes = (row) => {
  const h = String(row.h ?? "").trim(),
    m = String(row.m ?? "").trim();
  if (h === "" && m === "") return null;
  return Math.max(0, Math.round((+h || 0) * 60 + (+m || 0)));
};

// Format minutes as "1 h 30 min". Empty string for null.
const fmtTime = (mins) =>
  mins == null ? "" : `${Math.floor(mins / 60)} h ${mins % 60} min`;

// A staffing row the user has typed anything into.
const rowUsed = (row) =>
  [row.r, row.n, row.h, row.m].some((v) => String(v ?? "").trim() !== "");

// Totals for the staffing table. complete is false when any used row has an
// empty People or Time field, so the PDF leaves the totals for the pen.
const staffTotals = (p) => {
  const rows = (p.res || []).filter(rowUsed);
  const complete =
    rows.length > 0 &&
    rows.every((x) => String(x.n ?? "").trim() !== "" && rowMinutes(x) != null);
  return {
    people: Math.max(0, ...rows.map((x) => +x.n || 0)),
    minutes: rows.reduce((a, x) => a + (rowMinutes(x) || 0), 0),
    complete,
  };
};

const tot = (p) => {
  const t = staffTotals(p);
  return (
    "Most people at once: " +
    t.people +
    "  ·  Total time: " +
    fmtTime(t.minutes) +
    (t.complete || !(p.res || []).some(rowUsed)
      ? ""
      : "  ·  Some fields are empty and will be left blank on the PDF")
  );
};

// Returns normalized {lines, machines} data from a parsed backup, or null if invalid.
const parseBackup = (j) =>
  j && Array.isArray(j.lines)
    ? { lines: j.lines, machines: Array.isArray(j.machines) ? j.machines : [] }
    : null;

if (typeof module !== "undefined")
  module.exports = {
    id,
    esc,
    tot,
    parseBackup,
    rowMinutes,
    fmtTime,
    rowUsed,
    staffTotals,
  };
