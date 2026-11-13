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

// Returns normalized {lines, machines} data from a parsed backup, or null if invalid.
const parseBackup = (j) =>
  j && Array.isArray(j.lines)
    ? { lines: j.lines, machines: Array.isArray(j.machines) ? j.machines : [] }
    : null;

if (typeof module !== "undefined")
  module.exports = { id, esc, parseBackup, toMinutes, fmtTime };
