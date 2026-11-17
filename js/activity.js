// Activity log (admins only): who did what, and when. Kept in S.act, newest
// first (up to ACT_MAX), and shown with the print log and code usage on the
// Logs page. Entry: { t: ISO time, type, text, who: typed name, code: code
// name, role }. Events from the login screen (failed logins, automatic
// log-outs found at start-up) wait in localStorage "sp-actq" until the data
// is loaded. Like the print log, it is kept in this browser only.
const ACT_MAX = 5000;
const ACT_TYPES = {
  login: "Login",
  change: "Change",
  approval: "Approval",
  delete: "Deletion",
  data: "Export / import",
};
const ACTQ_KEY = "sp-actq";
let DATA_READY = false, // S holds the saved data (set by startApp)
  LTAB = "act", // Logs page tab: "act", "print" or "codes"
  AF = "", // activity filter text
  AT = ""; // activity filter type ("" = all)

const actEntry = (type, text, s = SESSION) => ({
  t: new Date().toISOString(),
  type,
  text,
  who: (s && s.who) || "",
  code: (s && s.name) || "",
  role: (s && s.r) || "",
});
function logAct(type, text) {
  if (!DATA_READY) return queueAct(actEntry(type, text));
  S.act = S.act || [];
  S.act.unshift(actEntry(type, text));
  if (S.act.length > ACT_MAX) S.act.length = ACT_MAX;
  save();
}
function queueAct(e) {
  try {
    const q = JSON.parse(localStorage.getItem(ACTQ_KEY) || "[]");
    q.push(e);
    localStorage.setItem(ACTQ_KEY, JSON.stringify(q.slice(-200)));
  } catch (x) {}
}
// Move waiting entries into the log (oldest first, so they end up in order).
function flushActQueue() {
  let q = [];
  try {
    q = JSON.parse(localStorage.getItem(ACTQ_KEY) || "[]");
    localStorage.removeItem(ACTQ_KEY);
  } catch (e) {}
  if (!Array.isArray(q) || !q.length) return;
  S.act = [...q.reverse(), ...(S.act || [])]
    .sort((x, y) => (x.t < y.t ? 1 : x.t > y.t ? -1 : 0))
    .slice(0, ACT_MAX);
  save();
}

// ---------- Change history ----------
// A copy of the product/machine (and company details) is taken when its page
// opens; when you leave it (or log out, or make a PDF) the differences are
// logged as one "Edited …" entry.
let ACT_ITEM = null, // { id, kind, snap }
  CO_SNAP = null;
const findItem = (id) => {
  for (const l of S.lines) {
    const p = l.products.find((x) => x.id == id);
    if (p) return { p, kind: "product", l };
  }
  const m = S.machines.find((x) => x.id == id);
  return m ? { p: m, kind: "machine" } : null;
};
const itemLabel = (p, kind, l) =>
  kind == "machine"
    ? `machine "${p.name || "Untitled"}"`
    : `product "${p.name || "Untitled"}"${l ? ` (${l.name})` : ""}`;
function flushItem(keep) {
  if (!ACT_ITEM || !DATA_READY) return;
  const f = findItem(ACT_ITEM.id);
  if (f) {
    const d = itemDiff(ACT_ITEM.snap, f.p, S.co, f.kind);
    if (d.length)
      logAct(
        "change",
        `Edited ${itemLabel(f.p, f.kind, f.l)}: ${d.join("; ")}`,
      );
    ACT_ITEM.snap = copyData(f.p);
  }
  if (!keep) ACT_ITEM = null;
}
const coCopy = () => ({
  name: S.co.name,
  depts: S.co.depts.map((d) => d.name),
  logo: S.logo || "",
});
function flushCompany() {
  if (!CO_SNAP) return;
  const now = coCopy(),
    d = [];
  if (String(CO_SNAP.name).trim() != String(now.name).trim())
    d.push(`name "${CO_SNAP.name}" → "${now.name}"`);
  if (stableJson(CO_SNAP.depts) != stableJson(now.depts))
    d.push(`departments: ${now.depts.filter((x) => x.trim()).join(", ")}`);
  if (CO_SNAP.logo != now.logo)
    d.push(now.logo ? "logo changed" : "logo removed");
  if (d.length) logAct("change", `Company details changed: ${d.join("; ")}`);
  CO_SNAP = null;
}
// Called by R() before drawing: notice when an item or the company page is
// left or opened.
function actTrack() {
  if (!DATA_READY) return;
  const p = (T == "p" && V.p) || (T == "m" && MID) ? P() : null;
  if (ACT_ITEM && (!p || p.id != ACT_ITEM.id)) flushItem();
  if (p && !ACT_ITEM) ACT_ITEM = { id: p.id, snap: copyData(p) };
  if (T != "co" && CO_SNAP) flushCompany();
  if (T == "co" && !CO_SNAP && S.co.done) CO_SNAP = coCopy();
}
// Leaving the page or hiding the tab also records changes made so far.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState == "hidden") {
    flushItem(true);
    if (CO_SNAP) {
      flushCompany();
      if (T == "co") CO_SNAP = coCopy();
    }
  }
});

// ---------- Logs page (admins) ----------
const actWho = (e) =>
  [e.who, e.code && (e.who ? `(${e.code})` : e.code)]
    .filter(Boolean)
    .join(" ") || "–";
const actShown = () => {
  const q = AF.trim().toLowerCase();
  return (S.act || []).filter(
    (e) =>
      (!AT || e.type == AT) &&
      (!q ||
        [logTime(e.t), ACT_TYPES[e.type], e.text, e.who, e.code]
          .join(" ")
          .toLowerCase()
          .includes(q)),
  );
};

function LogsV() {
  const tab = (k, n) =>
    `<button class="tabb${LTAB == k ? " on" : ""}" data-a="ltab" data-t="${k}" aria-pressed="${LTAB == k}">${n}</button>`;
  return (
    `<button class="lk" data-a="goHome">← Home</button><h1>Logs</h1>` +
    `<p class="m">For admins. Kept in this browser only: each computer has its own logs. Download them to keep or combine them.</p>` +
    `<div class="tabs" role="group" aria-label="Log">${tab("act", "Activity")}${tab("print", "Print log")}${tab("codes", "Code usage")}</div>` +
    (LTAB == "print" ? LogV() : LTAB == "codes" ? CodesV() : ActV())
  );
}

function ActV() {
  const all = S.act || [],
    list = actShown();
  if (!all.length)
    return `<p class="note">Nothing recorded yet. Logins, changes, approvals, deletions, exports and imports are listed here.</p>`;
  return (
    `<div class="row" style="flex-wrap:wrap"><select data-at="1" aria-label="Type" style="width:auto;margin:0"><option value="">All types</option>${Object.entries(
      ACT_TYPES,
    )
      .map(
        ([k, n]) =>
          `<option value="${k}"${AT == k ? " selected" : ""}>${n}</option>`,
      )
      .join(
        "",
      )}</select><input type="search" data-af="1" value="${esc(AF)}" placeholder="Filter: name, product, date or text" aria-label="Filter the activity log" style="flex:1"></div>` +
    `<p class="m">${AF.trim() || AT ? `${count(list.length, "entry", "entries")} of ${all.length}` : count(all.length, "entry", "entries")}</p>` +
    `<div class="logw"><table class="log alog"><thead><tr><th>Date and time</th><th>Type</th><th>What</th><th>Who</th></tr></thead><tbody>` +
    list
      .slice(0, 500)
      .map(
        (e) =>
          `<tr class="act-${esc(e.type)}"><td>${logTime(e.t)}</td><td>${esc(ACT_TYPES[e.type] || e.type)}</td><td>${esc(e.text)}</td><td>${esc(actWho(e))}</td></tr>`,
      )
      .join("") +
    `</tbody></table></div>` +
    (list.length > 500
      ? `<p class="m">Showing the newest 500. Download the log to see all.</p>`
      : "") +
    `<div class="row" style="flex-wrap:wrap"><button class="b" data-a="actCsv">Download activity (Excel / CSV)</button><button class="b d" data-a="actClear">Clear activity log</button></div>`
  );
}

// Every code with its last login and PDFs on this computer.
function codeUsage() {
  const rows = [];
  for (const [r, list] of Object.entries(roleLists()))
    for (const [name] of list) {
      const logins = (S.act || []).filter(
          (e) =>
            e.type == "login" &&
            e.text == "Logged in" &&
            e.code == name &&
            e.role == r,
        ),
        pdfs = (S.log || []).filter((e) => e.who == name),
        people = [
          ...new Set(
            [...logins.map((e) => e.who), ...pdfs.map((e) => e.person)].filter(
              Boolean,
            ),
          ),
        ];
      rows.push({
        r,
        name,
        logins: logins.length,
        last: logins[0] ? logins[0].t : "",
        pdfs: pdfs.length,
        lastPdf: pdfs[0] ? pdfs[0].t : "",
        people,
      });
    }
  return rows;
}
function CodesV() {
  const rows = codeUsage();
  if (!rows.length) return `<p class="note">There are no codes.</p>`;
  const unused = rows.filter((x) => !x.logins && !x.pdfs).length;
  return (
    `<p class="m">Logins and PDFs on this computer for each code. ${unused ? `${count(unused, "code has", "codes have")} not been used here: if a code is not needed any more, remove it.` : ""}</p>` +
    `<div class="logw"><table class="log"><thead><tr><th>Code</th><th>Role</th><th>Logins</th><th>Last login</th><th>PDFs</th><th>Last PDF</th><th>Names used</th></tr></thead><tbody>` +
    rows
      .map(
        (x) =>
          `<tr${x.logins || x.pdfs ? "" : ` class="unused"`}><td><b>${esc(x.name)}</b></td><td>${ROLE_NAMES[x.r]}</td><td>${x.logins}</td><td>${x.last ? logTime(x.last) : "–"}</td><td>${x.pdfs}</td><td>${x.lastPdf ? logTime(x.lastPdf) : "–"}</td><td>${esc(x.people.join(", ")) || "–"}</td></tr>`,
      )
      .join("") +
    `</tbody></table></div><button class="b" data-a="codesCsv">Download code usage (Excel / CSV)</button>`
  );
}

// CSV that opens in Excel (UTF-8 with a byte order mark).
function csvFile(name, rows) {
  const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return dl(
    name,
    new Blob(["﻿" + rows.map((r) => r.map(q).join(",")).join("\r\n")], {
      type: "text/csv",
    }),
  );
}
const actCsv = () =>
  csvFile(`activity-log-${dateStamp()}.csv`, [
    ["Date and time", "Type", "What", "Name", "Code", "Role"],
    ...actShown().map((e) => [
      logTime(e.t),
      ACT_TYPES[e.type] || e.type,
      e.text,
      e.who,
      e.code,
      ROLE_NAMES[e.role] || "",
    ]),
  ]);
const codesCsv = () =>
  csvFile(`code-usage-${dateStamp()}.csv`, [
    ["Code", "Role", "Logins", "Last login", "PDFs", "Last PDF", "Names used"],
    ...codeUsage().map((x) => [
      x.name,
      ROLE_NAMES[x.r],
      x.logins,
      x.last ? logTime(x.last) : "",
      x.pdfs,
      x.lastPdf ? logTime(x.lastPdf) : "",
      x.people.join(", "),
    ]),
  ]);

document.addEventListener("input", (e) => {
  const t = e.target;
  if (t.dataset.af === undefined) return;
  AF = t.value;
  const pos = t.selectionStart;
  R(true);
  const f = $("[data-af]");
  f.focus();
  f.setSelectionRange(pos, pos);
});
document.addEventListener("change", (e) => {
  if (e.target.dataset.at === undefined) return;
  AT = e.target.value;
  R(true);
  $("[data-at]").focus();
});
