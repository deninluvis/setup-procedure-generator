// Print log: every PDF made in this browser, newest first, in S.log (saved
// with the data and included in full backups). Each entry:
// { t: ISO time, kind, name, code, rev, line, dept, ref, who, file, pages,
//   status: "Approved" / "Draft" }.
const LOG_MAX = 2000;
let LF = ""; // filter text on the Print log page

function logPdf(p, file, pages, ref, status) {
  S.log = S.log || [];
  S.log.unshift({
    t: new Date().toISOString(),
    kind: T == "m" ? "machine" : "product",
    name: p.name || "",
    code: p.code || "",
    rev: p.rev || "",
    line: T == "m" ? "" : (L() || {}).name || "",
    dept: deptName(deptOf(p, S.co), S.co) || "",
    ref: ref || "",
    who: accessName(),
    file,
    pages,
    status: status || "",
  });
  if (S.log.length > LOG_MAX) S.log.length = LOG_MAX;
  save();
}

// "2026-11-17 13:42" in this computer's time zone.
const logTime = (iso) => {
  const d = new Date(iso);
  return isNaN(d)
    ? ""
    : `${dateStamp(d)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const logWho = (e) =>
  [e.who, e.ref && "Ref " + e.ref].filter(Boolean).join(" · ");
const logShown = () => {
  const q = LF.trim().toLowerCase(),
    all = S.log || [];
  return q
    ? all.filter((e) =>
        [logTime(e.t), e.name, e.code, e.rev, e.line, e.dept, e.who, e.ref]
          .join(" ")
          .toLowerCase()
          .includes(q),
      )
    : all;
};

function LogV() {
  const all = S.log || [],
    list = logShown();
  return (
    `<button class="lk" data-a="goHome">← Home</button><h1>Print log</h1>` +
    `<p class="m">Every PDF made in this browser, newest first: when, what, which revision, and which access code was used. The log is saved with your data and included in full backups. Up to ${LOG_MAX} entries are kept.</p>` +
    (all.length
      ? `<input type="search" data-lf="1" value="${esc(LF)}" placeholder="Filter: name, code, date, department or access code" aria-label="Filter the print log">` +
        `<p class="m">${LF.trim() ? `${count(list.length, "match", "matches")} of ${all.length}` : count(all.length, "PDF", "PDFs")}</p>` +
        `<div class="logw"><table class="log"><thead><tr><th>Date and time</th><th>Product / machine</th><th>Code</th><th>Rev</th><th>Status</th><th>Department</th><th>Access code</th><th>Pages</th></tr></thead><tbody>` +
        list
          .slice(0, 500)
          .map(
            (e) =>
              `<tr><td>${logTime(e.t)}</td><td><b>${esc(e.name || "Untitled")}</b><span class="m">${e.kind == "machine" ? "Machine" : "Product · " + esc(e.line)}</span></td><td>${esc(e.code)}</td><td>${esc(e.rev)}</td><td>${esc(e.status || "")}</td><td>${esc(e.dept)}</td><td>${esc(logWho(e)) || "–"}</td><td>${esc(e.pages)}</td></tr>`,
          )
          .join("") +
        `</tbody></table></div>` +
        (list.length > 500
          ? `<p class="m">Showing the newest 500. Download the log to see all.</p>`
          : "") +
        `<div class="row" style="flex-wrap:wrap"><button class="b" data-a="logCsv">Download log (Excel / CSV)</button><button class="b d" data-a="logClear">Clear log</button></div>`
      : `<p class="note">No PDFs made yet. Each PDF you download is listed here.</p>`)
  );
}

// The whole log (or the filtered part) as a CSV file that opens in Excel.
async function logCsv() {
  const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`,
    rows = [
      [
        "Date and time",
        "Type",
        "Name",
        "Code",
        "Revision",
        "Status",
        "Line",
        "Department",
        "Access code",
        "Reference",
        "File",
        "Pages",
      ],
      ...logShown().map((e) => [
        logTime(e.t),
        e.kind == "machine" ? "Machine" : "Product",
        e.name,
        e.code,
        e.rev,
        e.status,
        e.line,
        e.dept,
        e.who,
        e.ref,
        e.file,
        e.pages,
      ]),
    ];
  await dl(
    `print-log-${dateStamp()}.csv`,
    new Blob(["﻿" + rows.map((r) => r.map(q).join(",")).join("\r\n")], {
      type: "text/csv",
    }),
  );
}
