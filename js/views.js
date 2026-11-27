// Screens and the HTML they are built from: company setup, home, lists,
// the product/machine page, R() (re-render), storage meter, home search
// results and photo shrinking.
// A search box with a ✕ button that clears it (shown only when there is text).
// k = the input's data attribute (hs, xf, lf or af).
const sbox = (input, k, style = "") =>
  `<span class="sbox"${style ? ` style="${style}"` : ""}>${input}<button type="button" class="sclr" data-a="sClear" data-k="${k}" aria-label="Clear search">✕</button></span>`;
const add = (ph, a) =>
  `<div class="row"><input id="nw" placeholder="${ph}"><button class="b" data-a="${a}">Add</button></div>`;
const gal = (arr, k) =>
  `<div class="g">${arr.map((s, i) => `<div class="th"><img src="${s}" alt=""><button data-a="rmPh" data-k="${k}" data-i="${i}" aria-label="Remove photo">✕</button><button class="mk" data-a="mk" data-k="${k}" data-i="${i}" aria-label="Mark up photo" title="Mark up">✎</button></div>`).join("")}</div><label class="b2">＋ Add photo<input type="file" accept="image/*" multiple hidden data-up="${k}"></label>`;

// Company details (logo, name, department): set once, printed on every PDF.
const logoField = () =>
  S.logo
    ? `<img class="logo" src="${S.logo}" alt="Company logo"><div class="row" style="flex-wrap:wrap"><label class="b2">Change logo<input type="file" accept="image/*" hidden data-logo="1"></label><button class="b d" data-a="rmLogo">Remove logo</button></div>`
    : `<label class="b2">＋ Add logo<input type="file" accept="image/*" hidden data-logo="1"></label>`;
// Company setup screen. First visit: "Welcome" + Continue. Later: edit details.
const CoV = () => {
  const first = !S.co.done;
  return (
    (first ? "" : `<button class="lk" data-a="goHome">← Home</button>`) +
    `<h1>${first ? "Welcome" : "Company details"}</h1><p class="m">${first ? "Set up your company first. These details appear on every PDF." : "These details appear on every PDF."}</p>
<h2>Company logo</h2>${logoField()}
<label class="f">Company name<input data-co="name" value="${esc(S.co.name)}" placeholder="e.g. ACME Manufacturing"></label>
<span class="f">Departments</span><p class="m">Add each department. You pick one for every product and machine.</p>
${S.co.depts.map((d, i) => `<div class="drow"><input data-dept="${i}" value="${esc(d.name)}" placeholder="e.g. Assembly" aria-label="Department name"><button class="sm" data-a="rmDept" data-i="${i}" aria-label="Remove department">✕</button></div>`).join("")}
<button class="b2" data-a="addDept">＋ Add department</button>
<p class="err" id="coErr" hidden>Enter the company name to continue.</p>
<div class="row"><button class="b" data-a="coDone">${first ? "Continue" : "Save"}</button></div>
${first ? `<p class="m">Moving from another computer? <label class="lk">Import backup<input type="file" accept=".zip,.json,application/zip,application/json" hidden data-imp="1"></label></p>` : ""}`
  );
};
// Home page: company header, then pick Products or Machines.
const nProducts = () => S.lines.reduce((a, l) => a + l.products.length, 0);
const HomeV = () =>
  `<div class="cohead">${S.logo ? `<img class="logo" src="${S.logo}" alt="Company logo">` : ""}<div><h1>${esc(S.co.name)}</h1>${S.co.depts.length ? `<p class="m">${S.co.depts.map((d) => esc(d.name)).join(" · ")}</p>` : ""}</div></div>
<button class="lk" data-a="editCo">Edit company details</button>
${backupDue(S) ? `<div class="note"><p><b>${S.lastBackup ? `Your last backup was ${agoText(S.lastBackup)}.` : "You have not exported a backup yet."}</b> Your data is only stored in this browser. Export a backup and keep it somewhere safe.</p><button class="b" data-a="bk">Export backup</button></div>` : ""}
<h2>Setup procedures</h2>${sbox(`<input type="search" data-hs="1" value="${esc(HS)}" placeholder="Search products, machines, lines" aria-label="Find a product or machine" aria-controls="hres">`, "hs")}<div id="hres" aria-live="polite">${homeResults()}</div><p class="m">What do you want to work on?</p>
<div class="opts"><button class="opt" data-a="tab" data-t="p"><b>Products</b><span class="m">${S.lines.length} line${S.lines.length == 1 ? "" : "s"} · ${nProducts()} product${nProducts() == 1 ? "" : "s"}</span></button><button class="opt" data-a="tab" data-t="m"><b>Machines</b><span class="m">${S.machines.length} machine${S.machines.length == 1 ? "" : "s"}</span></button></div>
<h2>Storage</h2><div id="stor"><p class="m">Checking storage…</p></div>
<h2>Backup and sharing</h2><p class="m">Last backup: <b>${agoText(S.lastBackup)}</b>. Choose exactly what to export or import, including single products, lines, machines or a full backup.</p><div class="row" style="flex-wrap:wrap"><button class="b" data-a="goX">Export &amp; import</button><button class="b2" data-a="bk">Quick full backup</button></div>
<h2>Approvals</h2><p class="m">${(() => {
    const w = allItems().filter((x) => x.p.ap && x.p.ap.st == "pending").length;
    return w
      ? `${count(w, "procedure is", "procedures are")} waiting for approval. `
      : "";
  })()}Import an approval file you received from an approver.</p><button class="b2" data-a="goAp">Open approvals</button>
${isAdmin() ? `<h2>Logs</h2><p class="m">For admins: activity (logins, changes, approvals, deletions, exports and imports), the print log (${count((S.log || []).length, "PDF", "PDFs")}) and code usage on this computer.</p><button class="b2" data-a="goLog">Open logs</button>` : ""}
${isAdmin() ? `<div style="margin-top:24px"><button class="b d" data-a="clearAll">Clear all saved data</button></div>` : ""}`;
// "CODE · Department · " prefix for list cards (empty parts skipped).
const cardMeta = (p) =>
  [p.code, deptName(deptOf(p, S.co), S.co)]
    .filter((x) => String(x || "").trim())
    .map((x) => esc(x) + " · ")
    .join("");
// Department picker on the product/machine page.
const deptSel = (p) => {
  const cur = deptOf(p, S.co);
  return `<label class="f">Department<select data-f="dept"><option value="">— No department —</option>${S.co.depts
    .filter((d) => d.name.trim())
    .map(
      (d) =>
        `<option value="${esc(d.id)}"${d.id == cur ? " selected" : ""}>${esc(d.name)}</option>`,
    )
    .join("")}</select></label>`;
};
// One step on the product/machine page, with its sub-steps (3.1, 3.2, …).
// Most photos on one step or sub-step.
const MAX_STEP_PHOTOS = 3;
// Photos of a step or sub-step (o.img, then o.more): each with Mark up and
// Remove; "Add photo" takes one or several at once. at = data-i (and data-j).
// extra: more buttons for the same row (the sub-step's "Add warning or note").
const photoBtn = (o, rm, k, at, extra = "") => {
  const list = photosOf(o),
    many = list.length > 1;
  return (
    (list.length
      ? `<div class="sph${many ? " many" : ""}">${list
          .map(
            (img, n) =>
              `<div><img class="simg" src="${img}" alt="${many ? `Photo ${n + 1}` : ""}"><div class="row"><button class="lk" data-a="mk" data-k="${k}" ${at} data-n="${n}">✎ Mark up</button><button class="lk" data-a="${rm}" ${at} data-n="${n}">Remove${many ? "" : " photo"}</button></div></div>`,
          )
          .join("")}</div>`
      : "") +
    `<div class="row acts">${
      list.length >= MAX_STEP_PHOTOS
        ? `<p class="m">${MAX_STEP_PHOTOS} photos is the most for one step. Remove one to add another.</p>`
        : `<label class="b2">＋ ${list.length ? "Add another photo" : "Add photo"}<input type="file" accept="image/*" multiple hidden data-up="${k}" ${at}></label>`
    }${extra}</div>`
  );
};
// Warning, Caution or Note on a step or sub-step (o.warn = text, o.wtype = type).
// Same colours on the page and in the PDF.
const NOTE_TYPES = {
  warning: {
    label: "Warning",
    icon: "⚠",
    tip: "Describe the hazard and what to do, for example: Hot surface. Wear heat-resistant gloves.",
  },
  caution: {
    label: "Caution",
    icon: "⚠",
    tip: "Describe the risk of damage, for example: Do not overtighten. Maximum 25 Nm.",
  },
  note: {
    label: "Note",
    icon: "ℹ",
    tip: "Add a useful tip, for example: The fixture is kept in cabinet B.",
  },
};
const noteType = (o) => (NOTE_TYPES[o.wtype] ? o.wtype : "warning");
// The note box on the page. j is NaN for a step, the sub-step index otherwise.
function noteHtml(o, i, j, where) {
  if (o.warn === undefined) return "";
  const ty = noteType(o),
    nt = NOTE_TYPES[ty],
    jj = isNaN(j) ? "" : ` data-wj="${j}"`,
    jb = isNaN(j) ? "" : ` data-j="${j}"`;
  return `<div class="wbox t-${ty}"><div class="sh"><span class="wi" aria-hidden="true">${nt.icon}</span><select data-wt="${i}"${jj} aria-label="Type of note on ${where}">${Object.entries(
    NOTE_TYPES,
  )
    .map(
      ([k, v]) =>
        `<option value="${k}"${k == ty ? " selected" : ""}>${v.label}</option>`,
    )
    .join(
      "",
    )}</select><span class="sp"></span><button class="sm" data-a="rmW" data-i="${i}"${jb} aria-label="Remove the ${nt.label.toLowerCase()} from ${where}">✕</button></div><textarea data-w="${i}"${jj} rows="2" placeholder="${esc(nt.tip)}" aria-label="${nt.label} on ${where}">${esc(o.warn)}</textarea></div>`;
}
// A step (j is NaN) or one of its sub-steps.
const stepOrSub = (i, j) => (isNaN(j) ? P().steps[i] : P().steps[i].subs[j]);

const stepHtml = (s, i) => {
  const subs = s.subs || [];
  return `<div class="box"><div class="sh"><span class="n">${i + 1}</span><span class="sp"></span><button class="sm" data-a="up" data-i="${i}" aria-label="Move step ${i + 1} up">↑</button><button class="sm" data-a="dn" data-i="${i}" aria-label="Move step ${i + 1} down">↓</button><button class="sm" data-a="rmS" data-i="${i}" aria-label="Delete step ${i + 1}">✕</button></div>
<input data-h="${i}" placeholder="Step headline (optional)" value="${esc(s.h)}" style="font-weight:600" aria-label="Step ${i + 1} headline">${noteHtml(
    s,
    i,
    NaN,
    `step ${i + 1}`,
  )}<textarea data-s="${i}"  }<textarea data-s="${i}" placeholder="Describe this step" aria-label="Step ${i + 1} description">${esc(s.t)}</textarea>
${photoBtn(s, "rmSI", "step", `data-i="${i}"`)}
${subs
  .map(
    (
      u,
      j,
    ) => `<div class="sub"><div class="sh"><span class="n2">${i + 1}.${j + 1}</span><span class="sp"></span><button class="sm" data-a="subUp" data-i="${i}" data-j="${j}" aria-label="Move sub-step ${i + 1}.${j + 1} up">↑</button><button class="sm" data-a="subDn" data-i="${i}" data-j="${j}" aria-label="Move sub-step ${i + 1}.${j + 1} down">↓</button><button class="sm" data-a="rmSub" data-i="${i}" data-j="${j}" aria-label="Delete sub-step ${i + 1}.${j + 1}">✕</button></div>
${noteHtml(u, i, j, `sub-step ${i + 1}.${j + 1}`)}<textarea data-ss="${i}" data-sj="${j}" rows="2" placeholder="Describe sub-step ${i + 1}.${j + 1}" aria-label="Sub-step ${i + 1}.${j + 1}">${esc(u.t)}</textarea>
${photoBtn(u, "rmSubI", "sub", `data-i="${i}" data-j="${j}"`, u.warn === undefined ? `<button class="b2" data-a="addW" data-i="${i}" data-j="${j}">⚠ Add warning or note</button>` : "")}</div>`,
  )
  .join("")}
<div class="row acts${subs.length ? " st" : ""}">${s.warn === undefined ? `<button class="b2" data-a="addW" data-i="${i}">⚠ Add warning or note</button>` : ""}<button class="b2" data-a="addSub" data-i="${i}">＋ Add sub-step</button><button class="b2" data-a="insS" data-i="${i}">＋ Insert step below</button></div></div>`;
};

// "Tools required" list on the product/machine page. p.tools = [{ n, s, q }]
// (name, size / specification, quantity).
function toolsHtml(p) {
  const tools = p.tools || [],
    names = [
      ...new Set(
        [...S.lines.flatMap((l) => l.products), ...S.machines]
          .flatMap((x) => (x.tools || []).map((t) => t.n.trim()))
          .filter(Boolean),
      ),
    ].sort();
  return (
    `<h2>Tools required</h2><p class="m">List the tools needed for this setup. They print as a checklist before the procedure.</p>` +
    (tools.length
      ? `<div class="tl tlh" aria-hidden="true"><span>Tool</span><span>Size / specification</span><span>Qty</span><span></span></div>`
      : "") +
    tools
      .map(
        (t, i) =>
          `<div class="tl"><input class="tn" data-tool="${i}" data-tk="n" list="toolNames" value="${esc(t.n)}" placeholder="e.g. Torque wrench" aria-label="Tool ${i + 1}"><input class="ts" data-tool="${i}" data-tk="s" value="${esc(t.s)}" placeholder="e.g. 10–60 Nm" aria-label="Tool ${i + 1} size or specification"><input class="tq" data-tool="${i}" data-tk="q" type="number" min="1" inputmode="numeric" value="${esc(t.q)}" placeholder="Qty" aria-label="Tool ${i + 1} quantity"><button class="sm tr2" data-a="rmTool" data-i="${i}" aria-label="Remove tool ${i + 1}">✕</button></div>`,
      )
      .join("") +
    `<button class="b2" data-a="addTool">＋ Add tool</button><datalist id="toolNames">${names.map((n) => `<option value="${esc(n)}">`).join("")}</datalist>`
  );
}

const MV = () =>
  `<button class="lk" data-a="goHome">← Home</button><h1>Machines</h1><p class="m">Pick a machine, or add one.</p>` +
  (S.machines.length
    ? ""
    : `<p class="empty">No machines yet. Type a machine name below and press Add.</p>`) +
  S.machines
    .map(
      (m) =>
        `<div class="card" data-a="openM" data-id="${m.id}"><b>${esc(m.name)} ${apBadge(m)}</b><span class="m">${cardMeta(m)}${m.steps.length} step${m.steps.length == 1 ? "" : "s"}</span></div>`,
    )
    .join("") +
  add("Machine name", "addM");
// A selector for an element in #app built from its data-* attributes, so the
// same field can be found again after the page is re-drawn.
const selectorOf = (el) => {
  const attrs = [...el.attributes]
    .filter((a) => a.name.startsWith("data-") && a.name != "data-ind")
    .map((a) => `[${a.name}="${CSS.escape(a.value)}"]`)
    .join("");
  return attrs
    ? el.tagName.toLowerCase() + attrs
    : el.id
      ? "#" + CSS.escape(el.id)
      : null;
};

function R(keep) {
  // When re-drawing the same page (keep), put the cursor back where it was,
  // e.g. if a photo finishes processing while you are typing.
  const ae = document.activeElement,
    app = $("#app"),
    fsel =
      keep && ae && ae != document.body && app && app.contains(ae)
        ? selectorOf(ae)
        : null,
    caret =
      fsel && typeof ae.selectionStart == "number"
        ? [ae.selectionStart, ae.selectionEnd]
        : null;
  let h = "";
  // Approvers only see the Approvals page; the print log is for admins.
  if (isApprover()) T = "ap";
  else if (T == "log" && !isAdmin()) {
    T = "h";
    toast("Only admins can open the logs.", false);
  }
  actTrack();
  if (T == "x") {
    h = XV();
  } else if (T == "log") {
    h = LogsV();
  } else if (T == "ap") {
    h = ApV();
  } else if (T == "co") {
    h = CoV();
  } else if (T == "h") {
    h = HomeV();
  } else if (T == "m" && !MID) {
    h = MV();
  } else if (T == "p" && !V.l) {
    h =
      `<button class="lk" data-a="goHome">← Home</button><h1>Products</h1><p class="m">Pick a product line, or add one.</p>` +
      (S.lines.length
        ? ""
        : `<p class="empty">No product lines yet. Type a name below (for example "Line 1") and press Add.</p>`) +
      S.lines
        .map(
          (l) =>
            `<div class="card" data-a="openL" data-id="${l.id}"><b>${esc(l.name)}</b><span class="m">${l.products.length} product${l.products.length == 1 ? "" : "s"}</span></div>`,
        )
        .join("") +
      add("Line name, e.g. Line 1", "addL") +
      `<p class="m">Use the same line name on every computer: imported products go into the line with the same name.</p>`;
  } else if (T == "p" && !V.p) {
    const l = L();
    h =
      `<button class="lk" data-a="home">← All lines</button><h1>${esc(l.name)}</h1><p class="m">Pick a product, or add one.</p>` +
      (l.products.length
        ? ""
        : `<p class="empty">No products in this line yet. Type a product name below and press Add.</p>`) +
      l.products
        .map(
          (p) =>
            `<div class="card" data-a="openP" data-id="${p.id}"><b>${esc(p.name)} ${apBadge(p)}</b><span class="m">${cardMeta(p)}${p.steps.length} step${p.steps.length == 1 ? "" : "s"}</span></div>`,
        )
        .join("") +
      add("Product name", "addP") +
      `<div class="row" style="flex-wrap:wrap"><button class="b2" data-a="renL">Rename line</button><button class="b2" data-a="exLine">Export this line</button><button class="b d" data-a="delL">Delete this line</button></div>`;
  } else {
    const p = P(),
      mm = T == "m";
    h =
      (mm
        ? `<button class="lk" data-a="mhome">← All machines</button>`
        : `<button class="lk" data-a="openL" data-id="${V.l}">← ${esc(L().name)}</button>`) +
      `<h1>${esc(p.name) || (mm ? "New machine" : "New product")}</h1>${apBox(p)}${itemHelp(mm)}
<label class="f">${mm ? "Machine name" : "Product name"}<input data-f="name" value="${esc(p.name)}"></label>
${deptSel(p)}
<div class="two"><label class="f">${mm ? "Machine ID / asset no." : "Product code"}<input data-f="code" value="${esc(p.code)}"></label><label class="f">Revision<input data-f="rev" value="${esc(p.rev)}"></label></div>
<h2>${mm ? "Machine photos" : "Product photos"}</h2>${gal(p.prod, "prod")}
<h2>${mm ? "Control panel / nameplate photos" : "Packaging photos"}</h2>${gal(p.pack, "pack")}
${ppeHtml(p)}
${toolsHtml(p)}
<h2>Steps</h2>` +
      (p.steps.length
        ? ""
        : `<p class="empty">No steps yet. Press <b>Add step</b> to write the first one.</p>`) +
      p.steps.map((s, i) => stepHtml(s, i)).join("") +
      `<button class="b2" data-a="addS">＋ Add step</button>
<h2>Sign-off</h2><div class="two"><div><span class="f">Time required</span><div class="hm"><label><input type="number" min="0" inputmode="numeric" data-f="th" aria-label="Time required, hours" value="${esc(p.th)}"><span class="m">Hours</span></label><label><input type="number" min="0" max="59" inputmode="numeric" data-f="tm" aria-label="Time required, minutes" value="${esc(p.tm)}"><span class="m">Minutes</span></label></div></div><label class="f">Technicians required<input type="number" min="0" inputmode="numeric" data-f="tech" value="${esc(p.tech)}"></label></div>
<p class="m">Leave time or technicians empty to write them in by hand on the printed PDF.</p>
<div class="two"><label class="f">Prepared by<input data-f="by" value="${esc(p.by)}"></label><div><span class="f">Approved by</span><p class="apby">${(() => {
        const r = AP_NOW.get(p.id);
        return r && r.st == "approved"
          ? `<b>${esc(r.name)}</b> <span class="m">(${apDay(r.at)}, signature checked)</span>`
          : `<span class="m">Filled in when the ${mm ? "machine" : "product"} is approved (see the top of this page).</span>`;
      })()}</p></div></div>
<label class="f">Date<input type="date" data-f="date" value="${esc(p.date)}"></label>
${wmBox(p)}${psBox()}
<div class="row" style="flex-wrap:wrap"><button class="b" data-a="pdf">Download PDF</button><button class="b2" data-a="dupP">Duplicate</button><button class="b2" data-a="exItem">Export this ${mm ? "machine" : "product"}</button><button class="b d" data-a="delP">Delete ${mm ? "machine" : "product"}</button></div>`;
  }
  $("#app").innerHTML = userBar() + h;
  document
    .querySelectorAll("[data-ind]")
    .forEach((e) => (e.indeterminate = true));
  if (!keep) window.scrollTo(0, 0);
  if (fsel) {
    const el = $(fsel);
    if (el) {
      el.focus({ preventScroll: true });
      if (caret)
        try {
          el.setSelectionRange(caret[0], caret[1]);
        } catch (e) {}
    }
  }
  if (T == "h") showStorage();
  if ((T == "p" && V.p) || (T == "m" && MID)) apRefresh();
}

// Storage meter on the home page.
async function showStorage() {
  const s = await Store.info(S),
    el = $("#stor");
  if (!el) return;
  const pct = Math.min(
      100,
      Math.max(1, Math.round((s.used / (s.used + s.free)) * 100)),
    ),
    low = s.big ? s.free < 50 * 1024 * 1024 : s.free < 1024 * 1024;
  el.innerHTML =
    `<p class="m">Your data: <b>${fmtBytes(s.used)}</b> · Free space: <b>${fmtBytes(s.free)}</b></p><div class="meter" role="img" aria-label="${pct}% of storage used"><span style="width:${pct}%"></span></div>` +
    (low
      ? `<p class="err">Storage is almost full. Export a backup, then remove some photos or products.</p>`
      : "") +
    (s.big
      ? ""
      : `<p class="m">This browser only allows about 5 MB here. For much more space, use Chrome or Edge, or open the app from a web address instead of a file.</p>`);
}

// Shrink an image file to fit max px. PNG keeps transparency (used for the logo).
// Resolves null when the browser cannot read the image (e.g. HEIC in Chrome).
// Photos: up to 2000 px, high-quality JPEG, so the PDF stays sharp when zoomed.
const comp = (f, png = false, max = 2000) =>
  new Promise((r) => {
    const u = URL.createObjectURL(f),
      i = new Image();
    i.onerror = () => {
      URL.revokeObjectURL(u);
      r(null);
    };
    i.onload = () => {
      if (!i.width || !i.height) return i.onerror();
      const k = Math.min(1, max / Math.max(i.width, i.height)),
        c = document.createElement("canvas");
      c.width = i.width * k;
      c.height = i.height * k;
      const g = c.getContext("2d");
      if (!png) {
        // JPEG has no transparency: use white instead of black behind it.
        g.fillStyle = "#fff";
        g.fillRect(0, 0, c.width, c.height);
      }
      g.drawImage(i, 0, 0, c.width, c.height);
      URL.revokeObjectURL(u);
      r(png ? c.toDataURL("image/png") : c.toDataURL("image/jpeg", 0.85));
    };
    i.src = u;
  });

// ---------- Home page search ----------

// Matching products and machines as buttons that open them. Up to 50 shown.
function homeResults() {
  const q = HS.trim().toLowerCase();
  if (!q) return "";
  const hits = exItems().filter((it) =>
    [it.p.name, it.p.code, it.line, it.dept].some((v) =>
      String(v || "")
        .toLowerCase()
        .includes(q),
    ),
  );
  if (!hits.length)
    return `<p class="m">No product or machine matches "${esc(HS.trim())}".</p>`;
  return (
    `<p class="m">${count(hits.length, "match", "matches")}${hits.length > 50 ? ", showing the first 50" : ""}. Press Enter to open the first one.</p>` +
    hits
      .slice(0, 50)
      .map(
        (it) =>
          `<button class="card hit" data-a="openHit" data-k="${it.key}"><b>${esc(it.p.name || "Untitled")}</b><span class="m">${[
            it.kind == "machine" ? "Machine" : "Product · " + it.line,
            it.p.code,
            it.dept,
          ]
            .filter((x) => String(x || "").trim())
            .map(esc)
            .join(" · ")}</span></button>`,
      )
      .join("")
  );
}
