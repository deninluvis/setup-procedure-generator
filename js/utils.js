// Pure helpers shared by app.js. Loaded as a classic script in the browser,
// and as a CommonJS module by the tests.

const id = () => Math.random().toString(36).slice(2, 9);
const esc = (s) =>
  String(s == null ? "" : s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
const tot = (p) => {
  const r = p.res || [];
  return (
    "Most people at once: " +
    Math.max(0, ...r.map((x) => +x.n || 0)) +
    "  ·  Total time: " +
    r.reduce((a, x) => a + (+x.m || 0), 0) +
    " min"
  );
};

// Returns normalized {lines, machines} data from a parsed backup, or null if invalid.
const parseBackup = (j) =>
  j && Array.isArray(j.lines)
    ? { lines: j.lines, machines: Array.isArray(j.machines) ? j.machines : [] }
    : null;

if (typeof module !== "undefined")
  module.exports = { id, esc, tot, parseBackup };
