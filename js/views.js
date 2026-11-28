// Screens and the HTML they are built from: company setup, home, lists,
// the product/machine page, R() (re-render), storage meter, home search
// results and photo shrinking.

// Line icons (inline SVG in the text colour). Text symbols such as ⚠ or ✎
// show as coloured emoji on some phones, so the app draws its own.
const icon = (d) =>
  `<svg class="ic" viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true">${d}</svg>`;
const IC = {
  x: icon('<path d="M6 6l12 12M18 6L6 18"/>'),
  pen: icon('<path d="M4 20l1-5L16 4l4 4L9 19z"/><path d="M13.5 6.5l4 4"/>'),
  warn: icon('<path d="M12 3.5L2.5 20h19z"/><path d="M12 10v4.5M12 17.2v.3"/>'),
  info: icon('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.6v.3"/>'),
  left: icon('<path d="M15 5l-7 7 7 7"/>'),
  right: icon('<path d="M9 5l7 7-7 7"/>'),
  gear: icon(
    '<path d="M19.2 9.4 L21.9 9.7 L21.9 14.3 L19.2 14.6 L18.9 15.2 L20.6 17.4 L17.4 20.6 L15.2 18.9 L14.6 19.2 L14.3 21.9 L9.7 21.9 L9.4 19.2 L8.8 18.9 L6.6 20.6 L3.4 17.4 L5.1 15.2 L4.8 14.6 L2.1 14.3 L2.1 9.7 L4.8 9.4 L5.1 8.8 L3.4 6.6 L6.6 3.4 L8.8 5.1 L9.4 4.8 L9.7 2.1 L14.3 2.1 L14.6 4.8 L15.2 5.1 L17.4 3.4 L20.6 6.6 L18.9 8.8Z"/><circle cx="12" cy="12" r="3.2"/>',
  ),
};
// A question in an app-styled box (instead of the browser's confirm()).
// Resolves true for the main button, false for Cancel, Esc or a tap outside.
// o: { title, ok: "Delete", danger: true (red main button), cancel, html }
function ask(msg, o = {}) {
  return new Promise((done) => {
    const old = $("#ask");
    if (old) old.remove();
    if ($(".kmenu")) {
      MENU = ""; // close a ⋮ menu still showing under the question
      R(true);
    }
    const prev = document.activeElement,
      el = document.createElement("div");
    el.id = "ask";
    el.setAttribute("role", "alertdialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-labelledby", "askt");
    el.innerHTML = `<div class="askbox">${o.title ? `<h2>${esc(o.title)}</h2>` : ""}<div id="askt">${o.html ? msg : `<p>${esc(msg)}</p>`}</div><div class="row"><button class="b2" data-ask="0">${esc(o.cancel || "Cancel")}</button><button class="b${o.danger ? " dng" : ""}" data-ask="1">${esc(o.ok || "OK")}</button></div></div>`;
    const end = (v) => {
      document.removeEventListener("keydown", key, true);
      el.remove();
      if (prev && prev.isConnected) prev.focus({ preventScroll: true });
      done(v);
    };
    const key = (e) => {
      if (e.key == "Escape") {
        e.preventDefault();
        e.stopPropagation();
        end(false);
      } else if (e.key == "Tab") {
        // keep the focus on the two buttons
        const b = [...el.querySelectorAll("button")],
          k = b.indexOf(document.activeElement);
        e.preventDefault();
        b[(k + (e.shiftKey ? b.length - 1 : 1)) % b.length].focus();
      }
    };
    el.addEventListener("click", (e) => {
      const b = e.target.closest("[data-ask]");
      if (b) end(b.dataset.ask == "1");
      else if (e.target == el) end(false);
    });
    document.addEventListener("keydown", key, true);
    document.body.append(el);
    el.querySelector('[data-ask="1"]').focus();
  });
}
// A search box with a ✕ button that clears it (shown only when there is text).
// k = the input's data attribute (hs, xf, lf or af).
const sbox = (input, k, style = "") =>
  `<span class="sbox"${style ? ` style="${style}"` : ""}>${input}<button type="button" class="sclr" data-a="sClear" data-k="${k}" aria-label="Clear search">${IC.x}</button></span>`;
// ⋮ menus. MENU = id of the open one ("" = none): "t" page title, "s:2"
// step 3, "u:2:0" sub-step 3.1, "user" account. items() builds the options
// only while it is open, so they always match the current state.
let MENU = "";
const kebab = (id, items, label = "More actions", btn = "⋮", cls = "kb") =>
  `<div class="kebab"><button type="button" class="${cls}" data-a="menu" data-m="${id}" aria-haspopup="true" aria-expanded="${MENU == id}" aria-label="${label}">${btn}</button>${MENU == id ? `<div class="kmenu">${items()}</div>` : ""}</div>`;
// Page title with its ⋮ menu on the right (extra: buttons before the ⋮).
// PICK: the title menu shows a list of the other lines to pick from
// ("dup" = duplicate there, "merge" = merge this line into it).
let PICK = "";
const linePicker = (a, q) =>
  `<div class="kinfo"><b>${q}</b></div>` +
  S.lines
    .filter((x) => x.id != V.l)
    .map(
      (x) =>
        `<button data-a="${a}" data-l="${esc(x.id)}">${esc(x.name)}</button>`,
    )
    .join("") +
  `<hr><button data-a="pickBack">← Back</button>`;
const titleMenu = (title, items, extra = "") =>
  `<div class="hrow"><h1>${title}</h1>${extra}${kebab("t", items)}</div>`;
// "＋ New line" (product, machine): a button that opens the name box.
// ADDING = which box is open.
let ADDING = "";
const add = (ph, a, label) =>
  ADDING == a
    ? `<div class="row"><input id="nw" placeholder="${ph}" aria-label="${ph}"><button class="b" data-a="${a}">Add</button><button class="b2" data-a="addCancel">Cancel</button></div>`
    : `<button class="b2" data-a="addOpen" data-k="${a}">＋ ${label}</button>`;
// A section of the product/machine page that can be closed (remembered).
const sec = (k, title, sum, body) =>
  `<details class="sec" data-sec="${k}"${SECS.has(k) ? "" : " open"}><summary><span class="stt">${title}</span><span class="m">${sum}</span></summary>${body}</details>`;
// Full-screen photo of a step or sub-step: VIEW = { k, i, j, n }.
let VIEW = null;
function viewerHtml() {
  if (!VIEW) return "";
  const { k, i, j, n } = VIEW,
    st = P().steps[i],
    o = st && (k == "step" ? st : (st.subs || [])[j]),
    src = o && photosOf(o)[n];
  if (!src) return (VIEW = null), "";
  const at = `data-k="${k}" data-i="${i}"${k == "sub" ? ` data-j="${j}"` : ""} data-n="${n}"`,
    last = photosOf(o).length - 1;
  return `<div id="pv" role="dialog" aria-modal="true" aria-label="Photo ${n + 1} of ${k == "step" ? `step ${i + 1}` : `sub-step ${i + 1}.${j + 1}`}" data-a="vClose"><img src="${src}" alt=""><div class="pvbar">${n > 0 ? `<button class="b2" data-a="phMv" data-d="-1" ${at}>${IC.left} Move left</button>` : ""}${n < last ? `<button class="b2" data-a="phMv" data-d="1" ${at}>Move right ${IC.right}</button>` : ""}</div><div class="pvbar"><button class="b2" data-a="mk" ${at}>${IC.pen} Mark up</button><button class="b2 d" data-a="${k == "step" ? "rmSI" : "rmSubI"}" ${at}>Remove</button><button class="b" data-a="vClose">Close</button></div></div>`;
}
const gal = (arr, k) =>
  `<div class="g">${arr.map((s, i) => `<div class="th"><img src="${s}" alt=""><button data-a="rmPh" data-k="${k}" data-i="${i}" aria-label="Remove photo">${IC.x}</button><button class="mk" data-a="mk" data-k="${k}" data-i="${i}" aria-label="Mark up photo" title="Mark up">${IC.pen}</button></div>`).join("")}</div><label class="b2">＋ Add photo<input type="file" accept="image/*" multiple hidden data-up="${k}"></label>`;

// Company details (logo, name, department): set once, printed on every PDF.
const logoField = () =>
  S.logo
    ? `<img class="logo" src="${S.logo}" alt="Company logo"><div class="row" style="flex-wrap:wrap"><label class="b2">Change logo<input type="file" accept="image/*" hidden data-logo="1"></label><button class="b d" data-a="rmLogo">Remove logo</button></div>`
    : `<label class="b2">＋ Add logo<input type="file" accept="image/*" hidden data-logo="1"></label>`;
// Company setup screen. First visit: "Welcome" + Continue. Later: edit details.
const CoV = () => {
  const first = !S.co.done;
  return (
    (first ? "" : `<button class="lk" data-a="goSet">← Settings</button>`) +
    `<h1>${first ? "Welcome" : "Company details"}</h1><p class="m">${first ? "Set up your company first. These details appear on every PDF." : "These details appear on every PDF."}</p>
<h2>Company logo</h2>${logoField()}
<label class="f">Company name<input data-co="name" value="${esc(S.co.name)}" placeholder="e.g. ACME Manufacturing"></label>
<span class="f">Departments</span><p class="m">Add each department. You pick one for every product and machine.</p>
${S.co.depts.map((d, i) => `<div class="drow"><input data-dept="${i}" value="${esc(d.name)}" placeholder="e.g. Assembly" aria-label="Department name"><button class="sm" data-a="rmDept" data-i="${i}" aria-label="Remove department">${IC.x}</button></div>`).join("")}
<button class="b2" data-a="addDept">＋ Add department</button>
<p class="err" id="coErr" hidden>Enter the company name to continue.</p>
<div class="row"><button class="b" data-a="coDone">${first ? "Continue" : "Save"}</button></div>
${first ? `<p class="m">Moving from another computer? <label class="lk">Import backup<input type="file" accept=".zip,.json,application/zip,application/json" hidden data-imp="1"></label></p>` : ""}`
  );
};
// Home page: company header, then pick Products or Machines.
const nProducts = () => S.lines.reduce((a, l) => a + l.products.length, 0);
const waiting = () =>
  allItems().filter((x) => x.p.ap && x.p.ap.st == "pending").length;
// "2 waiting · 1 rejected", empty when nothing needs action.
const apNeeds = () => {
  const r = allItems().filter((x) => x.p.ap && x.p.ap.st == "rejected").length;
  return [waiting() && `${waiting()} waiting`, r && `${r} rejected`]
    .filter(Boolean)
    .join(" · ");
};
const HomeV = () =>
  `<h1>${S.logo ? esc(S.co.name) : "Setup procedures"}</h1>
${apNeeds() ? `<div class="bkbar" role="status"><span>${apNeeds()}</span><button class="lk" data-a="goAp">Open approvals</button></div>` : ""}
${backupDue(S) ? `<div class="bkbar" role="status"><span>${S.lastBackup ? `Last backup: ${agoText(S.lastBackup)}` : "No backup yet"}</span><button class="lk" data-a="bk">Back up now</button></div>` : ""}
${sbox(`<input type="search" data-hs="1" value="${esc(HS)}" placeholder="Search products, machines, lines" aria-label="Find a product or machine" aria-controls="hres">`, "hs")}<div id="hres" aria-live="polite">${homeResults()}</div>
<div class="opts"><button class="opt" data-a="tab" data-t="p"><b>Products</b><span class="m">${S.lines.length} line${S.lines.length == 1 ? "" : "s"} · ${nProducts()} product${nProducts() == 1 ? "" : "s"}</span></button><button class="opt" data-a="tab" data-t="m"><b>Machines</b><span class="m">${S.machines.length} machine${S.machines.length == 1 ? "" : "s"}</span></button></div>`;
// "2026-11-27" -> "27 Nov 2026".
const fmtDay = (d) => {
  const [y, m, dd] = String(d).split("-").map(Number);
  return `${dd} ${"Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ")[m - 1] || ""} ${y}`;
};
// Settings (⚙ in the top bar): company, backup, approvals, storage, logs, clear data.
const SetV = () =>
  `<button class="lk" data-a="goHome">← Home</button><h1>Settings</h1>
<h2>Company</h2><div class="cohead">${S.logo ? `<img class="logo" src="${S.logo}" alt="Company logo">` : ""}<div><b>${esc(S.co.name)}</b>${S.co.depts.length ? `<p class="m">${S.co.depts.map((d) => esc(d.name)).join(" · ")}</p>` : ""}</div></div><button class="b2" data-a="editCo">Edit company details</button>
<h2>Backup and sharing</h2><p class="m">Last backup: <b>${agoText(S.lastBackup)}</b>. Choose exactly what to export or import, including single products, lines, machines or a full backup.</p><div class="row" style="flex-wrap:wrap"><button class="b" data-a="goX">Export &amp; import</button><button class="b2" data-a="bk">Quick full backup</button></div>
<h2>Approvals</h2><p class="m">${waiting() ? `${count(waiting(), "procedure", "procedures")} waiting for approval. ` : ""}Import the approval files (.json) that approvers send you.</p><button class="b2" data-a="goAp">Open approvals</button>
<h2>Appearance</h2><div class="radios seg" role="radiogroup" aria-label="Appearance">${[
    ["auto", "Same as the device"],
    ["light", "Light"],
    ["dark", "Dark"],
  ]
    .map(
      ([k, n]) =>
        `<label><input type="radio" name="theme" value="${k}"${THEME == k ? " checked" : ""}> ${n}</label>`,
    )
    .join("")}</div>
<h2 class="kbd-only">Keyboard shortcuts</h2><table class="log kbd-only"><tbody><tr><td><kbd>Ctrl</kbd> + <kbd>P</kbd></td><td>Make the PDF of the open product or machine.</td></tr><tr><td><kbd>Ctrl</kbd> + <kbd>Enter</kbd></td><td>Add a step after the step you are in (or at the end).</td></tr><tr><td><kbd>Ctrl</kbd> + <kbd>Z</kbd></td><td>Undo the last removal (when you do not type in a box).</td></tr><tr><td><kbd>Ctrl</kbd> + <kbd>S</kbd></td><td>Shows that your work is saved. The app saves automatically.</td></tr><tr><td><kbd>Esc</kbd></td><td>Close a menu, a photo or a question.</td></tr></tbody></table><p class="m kbd-only">On a Mac, use <kbd>⌘</kbd> instead of <kbd>Ctrl</kbd>.</p>
<h2>About</h2><p>Setup Procedures · Version <b>${esc(APP_VERSION)}</b> · ${esc(fmtDay(APP_DATE))}</p><p class="m">Works offline. Your data stays in this browser.</p>
<h2>Help</h2><p class="m">Step-by-step instructions for authors, approvers and admins.</p><a class="b2" href="docs/user-guide.pdf" target="_blank" rel="noopener">Open the user guide (PDF)</a>
<h2>Storage</h2><div id="stor"><p class="m">Checking storage…</p></div>
${isAdmin() ? `<h2>Logs</h2><p class="m">For admins: activity (logins, changes, approvals, deletions, exports and imports), the print log (${count((S.log || []).length, "PDF", "PDFs")}) and code usage on this computer.</p><button class="b2" data-a="goLog">Open logs</button>` : ""}
${isAdmin() ? `<h2>Danger zone</h2><button class="b d" data-a="clearAll">Clear all saved data</button>` : ""}`;
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
// Tap a photo to open it (Mark up, Remove).
const photoBtn = (o, rm, k, at) => {
  const list = photosOf(o),
    many = list.length > 1;
  return (
    (list.length
      ? `<div class="sph${many ? " many" : ""}">${list
          .map(
            (img, n) =>
              `<button class="simgb" data-a="view" data-k="${k}" ${at} data-n="${n}" aria-label="Open photo ${n + 1}"><img class="simg" src="${img}" alt=""></button>`,
          )
          .join("")}</div>`
      : "") +
    `<div class="row acts">${
      list.length >= MAX_STEP_PHOTOS
        ? `<p class="m">${MAX_STEP_PHOTOS} photos is the most for one step. Remove one to add another.</p>`
        : `<label class="b2">＋ ${list.length ? "Add another photo" : "Add photo"}<input type="file" accept="image/*" multiple hidden data-up="${k}" ${at}></label>`
    }</div>`
  );
};
// Warning, Caution or Note on a step or sub-step (o.warn = text, o.wtype = type).
// Same colours on the page and in the PDF.
const NOTE_TYPES = {
  warning: {
    label: "Warning",
    icon: IC.warn,
    tip: "Describe the hazard and what to do, for example: Hot surface. Wear heat-resistant gloves.",
  },
  caution: {
    label: "Caution",
    icon: IC.warn,
    tip: "Describe the risk of damage, for example: Do not overtighten. Maximum 25 Nm.",
  },
  note: {
    label: "Note",
    icon: IC.info,
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
    )}</select><span class="sp"></span><button class="sm" data-a="rmW" data-i="${i}"${jb} aria-label="Remove the ${nt.label.toLowerCase()} from ${where}">${IC.x}</button></div><textarea data-w="${i}"${jj} rows="2" placeholder="${esc(nt.tip)}" aria-label="${nt.label} on ${where}">${esc(o.warn)}</textarea></div>`;
}
// A step (j is NaN) or one of its sub-steps.
const stepOrSub = (i, j) => (isNaN(j) ? P().steps[i] : P().steps[i].subs[j]);

const stepHtml = (s, i) => {
  const subs = s.subs || [],
    n = P().steps.length;
  return `<div class="box" data-box="${i}"><div class="sh"><span class="dh" draggable="true" data-drag="${i}" title="Drag to move this step" aria-hidden="true">⠿</span><span class="n">${i + 1}</span><span class="sp"></span>${kebab(
    `s:${i}`,
    () =>
      (i > 0 ? `<button data-a="up" data-i="${i}">Move up</button>` : "") +
      (i < n - 1
        ? `<button data-a="dn" data-i="${i}">Move down</button>`
        : "") +
      `<button data-a="insS" data-i="${i}">Insert step below</button><button data-a="addSub" data-i="${i}">Add sub-step</button>` +
      (s.warn === undefined
        ? `<button data-a="addW" data-i="${i}">Add warning or note</button>`
        : "") +
      `<button class="d" data-a="rmS" data-i="${i}">Delete step</button>`,
    `Step ${i + 1} actions`,
  )}</div>
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
    ) => `<div class="sub"><div class="sh"><span class="n2">${i + 1}.${j + 1}</span><span class="sp"></span>${kebab(
      `u:${i}:${j}`,
      () =>
        (j > 0
          ? `<button data-a="subUp" data-i="${i}" data-j="${j}">Move up</button>`
          : "") +
        (j < subs.length - 1
          ? `<button data-a="subDn" data-i="${i}" data-j="${j}">Move down</button>`
          : "") +
        (u.warn === undefined
          ? `<button data-a="addW" data-i="${i}" data-j="${j}">Add warning or note</button>`
          : "") +
        `<button class="d" data-a="rmSub" data-i="${i}" data-j="${j}">Delete sub-step</button>`,
      `Sub-step ${i + 1}.${j + 1} actions`,
    )}</div>
${noteHtml(u, i, j, `sub-step ${i + 1}.${j + 1}`)}<textarea data-ss="${i}" data-sj="${j}" rows="2" placeholder="Describe sub-step ${i + 1}.${j + 1}" aria-label="Sub-step ${i + 1}.${j + 1}">${esc(u.t)}</textarea>
${photoBtn(u, "rmSubI", "sub", `data-i="${i}" data-j="${j}"`)}</div>`,
  )
  .join("")}
</div>`;
};

// "Tools required" list on the product/machine page. p.tools = [{ n, s, q }]
// (name, size / specification; q = quantity from older versions, no longer
// shown or printed but kept so earlier approvals still match).
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
    `<p class="m">List the tools needed for this setup. They print as a table before the procedure.</p>` +
    (tools.length
      ? `<div class="tl tlh" aria-hidden="true"><span>Tool</span><span>Size / specification</span><span></span></div>`
      : "") +
    tools
      .map(
        (t, i) =>
          `<div class="tl"><input class="tn" data-tool="${i}" data-tk="n" list="toolNames" value="${esc(t.n)}" placeholder="e.g. Torque wrench" aria-label="Tool ${i + 1}"><input class="ts" data-tool="${i}" data-tk="s" value="${esc(t.s)}" placeholder="e.g. 10–60 Nm" aria-label="Tool ${i + 1} size or specification"><button class="sm tr2" data-a="rmTool" data-i="${i}" aria-label="Remove tool ${i + 1}">${IC.x}</button></div>`,
      )
      .join("") +
    `<button class="b2" data-a="addTool">＋ Add tool</button><datalist id="toolNames">${names.map((n) => `<option value="${esc(n)}">`).join("")}</datalist>`
  );
}

// "Machine settings" on the product/machine page: p.set = [{ n, v, u }].
function settingsHtml(p) {
  const rows = p.set || [];
  return (
    `<p class="m">Settings to enter on the machine, such as temperatures, speeds, pressures or the program number. They print as a table before the procedure.</p>` +
    (rows.length
      ? `<div class="tl stl tlh" aria-hidden="true"><span>Parameter</span><span>Value</span><span>Unit</span><span></span></div>`
      : "") +
    rows
      .map(
        (x, i) =>
          `<div class="tl stl"><input class="tn" data-set="${i}" data-sk="n" value="${esc(x.n)}" placeholder="e.g. Mould temperature" aria-label="Setting ${i + 1}"><input class="ts" data-set="${i}" data-sk="v" value="${esc(x.v)}" placeholder="e.g. 220" aria-label="Setting ${i + 1} value"><input class="tq" data-set="${i}" data-sk="u" value="${esc(x.u)}" placeholder="Unit" aria-label="Setting ${i + 1} unit"><button class="sm tr2" data-a="rmSet" data-i="${i}" aria-label="Remove setting ${i + 1}">${IC.x}</button></div>`,
      )
      .join("") +
    `<button class="b2" data-a="addSet">＋ Add setting</button>`
  );
}

const MV = () =>
  `<button class="lk" data-a="goHome">← Home</button>${titleMenu("Machines", () => `<button data-a="pdfMach">Download all PDFs (ZIP)</button>`)}<p class="m">Pick a machine, or add one.</p>` +
  (S.machines.length
    ? ""
    : `<p class="empty">No machines yet. Press <b>＋ New machine</b> to add one.</p>`) +
  S.machines
    .map(
      (m) =>
        `<div class="card" data-a="openM" data-id="${m.id}"><b>${esc(m.name)} ${apBadge(m)}</b><span class="m">${cardMeta(m)}${m.steps.length} step${m.steps.length == 1 ? "" : "s"}</span></div>`,
    )
    .join("") +
  add("Machine name", "addM", "New machine");
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
  } else if (T == "set") {
    h = SetV();
  } else if (T == "m" && !MID) {
    h = MV();
  } else if (T == "p" && !V.l) {
    h =
      `<button class="lk" data-a="goHome">← Home</button><h1>Products</h1><p class="m">Pick a product line, or add one.</p>` +
      (S.lines.length
        ? ""
        : `<p class="empty">No product lines yet. Press <b>＋ New line</b> to add one, for example "Line 1".</p>`) +
      S.lines
        .map(
          (l) =>
            `<div class="card" data-a="openL" data-id="${l.id}"><b>${esc(l.name)}</b><span class="m">${l.products.length} product${l.products.length == 1 ? "" : "s"}</span></div>`,
        )
        .join("") +
      add("Line name, e.g. Line 1", "addL", "New line") +
      (ADDING == "addL"
        ? `<p class="m">Use the same line name on every computer: imported products go into the line with the same name.</p>`
        : "");
  } else if (T == "p" && !V.p) {
    const l = L();
    h =
      `<button class="lk" data-a="home">← All lines</button>${titleMenu(
        esc(l.name),
        () =>
          PICK
            ? linePicker("mergeL", `Merge "${esc(l.name)}" into which line?`)
            : `<button data-a="pdfLine">Download all PDFs (ZIP)</button><button data-a="renL">Rename line</button>${S.lines.length > 1 ? `<button data-a="pickLine" data-k="merge">Merge into another line…</button>` : ""}<button data-a="exLine">Export this line</button><button class="d" data-a="delL">Delete this line</button>`,
      )}<p class="m">Pick a product, or add one.</p>` +
      (l.products.length
        ? ""
        : `<p class="empty">No products in this line yet. Press <b>＋ New product</b> to add one.</p>`) +
      l.products
        .map(
          (p) =>
            `<div class="card" data-a="openP" data-id="${p.id}"><b>${esc(p.name)} ${apBadge(p)}</b><span class="m">${cardMeta(p)}${p.steps.length} step${p.steps.length == 1 ? "" : "s"}</span></div>`,
        )
        .join("") +
      add("Product name", "addP", "New product");
  } else {
    const p = P(),
      mm = T == "m";
    h =
      (mm
        ? `<button class="lk" data-a="mhome">← All machines</button>`
        : `<button class="lk" data-a="openL" data-id="${V.l}">← ${esc(L().name)}</button>`) +
      titleMenu(
        esc(p.name) || (mm ? "New machine" : "New product"),
        () =>
          PICK
            ? linePicker("dupP", "Duplicate into which line?")
            : `<div class="kopt">${wmBox(p)}${psBox()}</div><button data-a="pdf">Download PDF</button><hr>${apMenu(p)}${apMenu(p) ? "<hr>" : ""}<button data-a="dupP">Duplicate</button>${!mm && S.lines.length > 1 ? `<button data-a="pickLine" data-k="dup">Duplicate to another line…</button>` : ""}<button data-a="exItem">Export this ${mm ? "machine" : "product"}</button><button class="d" data-a="delP">Delete ${mm ? "machine" : "product"}</button>`,
        `<button class="apb" id="apbadge" data-a="apInfo" aria-expanded="${AP_OPEN}" aria-controls="apbox" title="Approval status">${apBadgeNow(p)}</button><button class="kb hb" data-a="help" aria-expanded="${HELPS.item}" aria-label="How to fill in this ${mm ? "machine" : "product"}" title="Help">?</button>`,
      ) +
      `${apBox(p)}${HELPS.item ? itemHelp(mm) : ""}
<label class="f">${mm ? "Machine name" : "Product name"}<input data-f="name" value="${esc(p.name)}"></label>
${deptSel(p)}
<div class="two"><label class="f">${mm ? "Machine ID / asset no." : "Product code"}<input data-f="code" value="${esc(p.code)}"></label><label class="f">Revision<input data-f="rev" value="${esc(p.rev)}"></label></div>
${sec("prod", mm ? "Machine photos" : "Product photos", count(p.prod.length, "photo", "photos"), gal(p.prod, "prod"))}
${sec("pack", mm ? "Control panel / nameplate photos" : "Packaging photos", count(p.pack.length, "photo", "photos"), gal(p.pack, "pack"))}
${sec("ppe", "Safety equipment (PPE)", count((p.ppe || []).length + (String(p.ppeo || "").trim() ? 1 : 0), "item", "items"), ppeHtml(p))}
${sec("tools", "Tools required", count((p.tools || []).filter((t) => String(t.n || "").trim()).length, "tool", "tools"), toolsHtml(p))}
${sec("set", "Machine settings", count(settingsOf(p).length, "setting", "settings"), settingsHtml(p))}
${sec(
  "steps",
  "Steps",
  count(p.steps.length, "step", "steps"),
  (p.steps.length
    ? ""
    : `<p class="empty">No steps yet. Press <b>Add step</b> to write the first one.</p>`) +
    p.steps.map((s, i) => stepHtml(s, i)).join("") +
    `<button class="b2" data-a="addS">＋ Add step</button>`,
)}
<details class="sec" data-sec="sign"${SECS.has("sign") ? "" : " open"}><summary><span class="stt">Sign-off</span><span class="m">${esc(p.by ? "Prepared by " + p.by : "")}</span></summary><div class="two"><div><span class="f">Time required</span><div class="hm"><label><input type="number" min="0" inputmode="numeric" data-f="th" aria-label="Time required, hours" value="${esc(p.th)}"><span class="m">Hours</span></label><label><input type="number" min="0" max="59" inputmode="numeric" data-f="tm" aria-label="Time required, minutes" value="${esc(p.tm)}"><span class="m">Minutes</span></label></div></div><label class="f">Technicians required<input type="number" min="0" inputmode="numeric" data-f="tech" value="${esc(p.tech)}"></label></div>
<p class="m">Leave empty to fill in by hand.</p>
<div class="two"><label class="f">Prepared by<input data-f="by" value="${esc(p.by)}"></label><div><span class="f">Approved by</span><p class="apby">${(() => {
        const r = AP_NOW.get(p.id);
        return r && r.st == "approved"
          ? `<b>${esc(r.name)}</b> <span class="m">(${apDay(r.at)}, signature checked)</span>`
          : `<span class="m">Filled in when approved.</span>`;
      })()}</p></div></div>
<label class="f">Date<input type="date" data-f="date" value="${esc(p.date)}"></label></details>
<p class="m">Download PDF, approval, duplicate, export and delete: in the <b>⋮</b> menu at the top right.</p>`;
  }
  $("#app").innerHTML = userBar() + h + (VIEW ? viewerHtml() : "");
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
  if (T == "set") showStorage();
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
