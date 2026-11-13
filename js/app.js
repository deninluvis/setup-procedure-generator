// Setup Procedures app: state, rendering, event handling and PDF export.
// Helpers (id, esc, parseBackup, toMinutes, fmtTime, normCo, deptOf,
// deptName, fmtBytes, backup helpers) come from js/utils.js, Store from
// js/storage.js and Zip from js/zip.js, all loaded first.
const $ = (s) => document.querySelector(s);
// Screens: T = "co" company setup, "h" home, "p" products, "m" machines,
// "x" export & import.
let S = { lines: [], machines: [] },
  // Export & import page: tree grouping ("line" or "dept") and filter text
  GRP = "line",
  XF = "",
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
const add = (ph, a) =>
  `<div class="row"><input id="nw" placeholder="${ph}"><button class="b" data-a="${a}">Add</button></div>`;
const gal = (arr, k) =>
  `<div class="g">${arr.map((s, i) => `<div class="th"><img src="${s}" alt=""><button data-a="rmPh" data-k="${k}" data-i="${i}" aria-label="Remove photo">✕</button></div>`).join("")}</div><label class="b2">＋ Add photo<input type="file" accept="image/*" multiple hidden data-up="${k}"></label>`;

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
<h2>Setup procedures</h2><p class="m">What do you want to work on?</p>
<div class="opts"><button class="opt" data-a="tab" data-t="p"><b>Products</b><span class="m">${S.lines.length} line${S.lines.length == 1 ? "" : "s"} · ${nProducts()} product${nProducts() == 1 ? "" : "s"}</span></button><button class="opt" data-a="tab" data-t="m"><b>Machines</b><span class="m">${S.machines.length} machine${S.machines.length == 1 ? "" : "s"}</span></button></div>
<h2>Storage</h2><div id="stor"><p class="m">Checking storage…</p></div>
<h2>Backup and sharing</h2><p class="m">Last backup: <b>${agoText(S.lastBackup)}</b>. Choose exactly what to export or import, including single products, lines, machines or a full backup.</p><div class="row" style="flex-wrap:wrap"><button class="b" data-a="goX">Export &amp; import</button><button class="b2" data-a="bk">Quick full backup</button></div>
<div style="margin-top:24px"><button class="b d" data-a="clearAll">Clear all saved data</button></div>`;
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
const MV = () =>
  `<button class="lk" data-a="goHome">← Home</button><h1>Machines</h1><p class="m">Pick a machine, or add one.</p>` +
  S.machines
    .map(
      (m) =>
        `<div class="card" data-a="openM" data-id="${m.id}"><b>${esc(m.name)}</b><span class="m">${cardMeta(m)}${m.steps.length} step${m.steps.length == 1 ? "" : "s"}</span></div>`,
    )
    .join("") +
  add("Machine name", "addM");
function R(keep) {
  let h = "";
  if (T == "x") {
    h = XV();
  } else if (T == "co") {
    h = CoV();
  } else if (T == "h") {
    h = HomeV();
  } else if (T == "m" && !MID) {
    h = MV();
  } else if (T == "p" && !V.l) {
    h =
      `<button class="lk" data-a="goHome">← Home</button><h1>Products</h1><p class="m">Pick a product line, or add one.</p>` +
      S.lines
        .map(
          (l) =>
            `<div class="card" data-a="openL" data-id="${l.id}"><b>${esc(l.name)}</b><span class="m">${l.products.length} product${l.products.length == 1 ? "" : "s"}</span></div>`,
        )
        .join("") +
      add("Line name, e.g. Line 1", "addL");
  } else if (T == "p" && !V.p) {
    const l = L();
    h =
      `<button class="lk" data-a="home">← All lines</button><h1>${esc(l.name)}</h1><p class="m">Pick a product, or add one.</p>` +
      l.products
        .map(
          (p) =>
            `<div class="card" data-a="openP" data-id="${p.id}"><b>${esc(p.name)}</b><span class="m">${cardMeta(p)}${p.steps.length} step${p.steps.length == 1 ? "" : "s"}</span></div>`,
        )
        .join("") +
      add("Product name", "addP") +
      `<div class="row" style="flex-wrap:wrap"><button class="b2" data-a="exLine">Export this line</button><button class="b d" data-a="delL">Delete this line</button></div>`;
  } else {
    const p = P(),
      mm = T == "m";
    h =
      (mm
        ? `<button class="lk" data-a="mhome">← All machines</button>`
        : `<button class="lk" data-a="openL" data-id="${V.l}">← ${esc(L().name)}</button>`) +
      `<h1>${esc(p.name) || (mm ? "New machine" : "New product")}</h1>
<label class="f">${mm ? "Machine name" : "Product name"}<input data-f="name" value="${esc(p.name)}"></label>
${deptSel(p)}
<div class="two"><label class="f">${mm ? "Machine ID / asset no." : "Product code"}<input data-f="code" value="${esc(p.code)}"></label><label class="f">Revision<input data-f="rev" value="${esc(p.rev)}"></label></div>
<h2>${mm ? "Machine photos" : "Product photos"}</h2>${gal(p.prod, "prod")}
<h2>${mm ? "Control panel / nameplate photos" : "Packaging photos"}</h2>${gal(p.pack, "pack")}
<h2>Steps</h2>` +
      p.steps
        .map(
          (
            s,
            i,
          ) => `<div class="box"><div class="sh"><span class="n">${i + 1}</span><span class="sp"></span><button class="sm" data-a="up" data-i="${i}" aria-label="Move up">↑</button><button class="sm" data-a="dn" data-i="${i}" aria-label="Move down">↓</button><button class="sm" data-a="rmS" data-i="${i}" aria-label="Delete step">✕</button></div>
<input data-h="${i}" placeholder="Step headline (optional)" value="${esc(s.h)}" style="font-weight:600"><textarea data-s="${i}" placeholder="Describe this step">${esc(s.t)}</textarea>
${s.img ? `<img class="simg" src="${s.img}" alt=""><button class="lk" data-a="rmSI" data-i="${i}">Remove photo</button>` : `<label class="b2">＋ Add photo<input type="file" accept="image/*" hidden data-up="step" data-i="${i}"></label>`}</div>`,
        )
        .join("") +
      `<button class="b2" data-a="addS">＋ Add step</button>
<h2>Sign-off</h2><div class="two"><div><span class="f">Time required</span><div class="hm"><label><input type="number" min="0" inputmode="numeric" data-f="th" aria-label="Time required, hours" value="${esc(p.th)}"><span class="m">Hours</span></label><label><input type="number" min="0" max="59" inputmode="numeric" data-f="tm" aria-label="Time required, minutes" value="${esc(p.tm)}"><span class="m">Minutes</span></label></div></div><label class="f">Technicians required<input type="number" min="0" inputmode="numeric" data-f="tech" value="${esc(p.tech)}"></label></div>
<p class="m">Leave time or technicians empty to write them in by hand on the printed PDF.</p>
<div class="two"><label class="f">Prepared by<input data-f="by" value="${esc(p.by)}"></label><label class="f">Approved by<input data-f="appr" value="${esc(p.appr)}"></label></div>
<label class="f">Date<input type="date" data-f="date" value="${esc(p.date)}"></label>
<div class="row" style="flex-wrap:wrap"><button class="b" data-a="pdf">Download PDF</button><button class="b2" data-a="exItem">Export this ${mm ? "machine" : "product"}</button><button class="b d" data-a="delP">Delete ${mm ? "machine" : "product"}</button></div>`;
  }
  $("#app").innerHTML = h;
  document
    .querySelectorAll("[data-ind]")
    .forEach((e) => (e.indeterminate = true));
  if (!keep) window.scrollTo(0, 0);
  if (T == "h") showStorage();
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

document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-a]");
  if (!t) return;
  const a = t.dataset.a,
    i = +t.dataset.i,
    nw = ($("#nw") || {}).value;
  if (a == "home") {
    V = { l: null, p: null };
  } else if (a == "openL") {
    V = { l: t.dataset.id, p: null };
  } else if (a == "openP") {
    V.p = t.dataset.id;
  } else if (a == "addL") {
    if (!nw || !nw.trim()) return;
    const l = { id: id(), name: nw.trim(), products: [] };
    S.lines.push(l);
    V = { l: l.id, p: null };
  } else if (a == "addP") {
    if (!nw || !nw.trim()) return;
    const p = {
      id: id(),
      name: nw.trim(),
      dept: (S.co.depts.find((d) => d.name.trim()) || {}).id || "",
      code: "",
      rev: "1",
      date: new Date().toISOString().slice(0, 10),
      prod: [],
      pack: [],
      steps: [{ t: "", img: "" }],
      by: "",
      appr: "",
    };
    L().products.push(p);
    V.p = p.id;
  } else if (a == "delL") {
    if (!confirm("Delete this line and all its products?")) return;
    S.lines = S.lines.filter((x) => x.id != V.l);
    V = { l: null, p: null };
  } else if (a == "delP") {
    if (!confirm("Delete this " + (T == "m" ? "machine" : "product") + "?"))
      return;
    if (T == "m") {
      S.machines = S.machines.filter((x) => x.id != MID);
      MID = null;
    } else {
      const l = L();
      l.products = l.products.filter((x) => x.id != V.p);
      V.p = null;
    }
  } else if (a == "rmPh") {
    P()[t.dataset.k].splice(i, 1);
  } else if (a == "addS") {
    P().steps.push({ t: "", img: "" });
  } else if (a == "rmS") {
    P().steps.splice(i, 1);
  } else if (a == "rmSI") {
    P().steps[i].img = "";
  } else if (a == "up" && i > 0) {
    const s = P().steps;
    [s[i - 1], s[i]] = [s[i], s[i - 1]];
  } else if (a == "dn" && i < P().steps.length - 1) {
    const s = P().steps;
    [s[i + 1], s[i]] = [s[i], s[i + 1]];
  } else if (a == "rmLogo") {
    if (!confirm("Remove the company logo?")) return;
    delete S.logo;
  } else if (a == "tab") {
    T = t.dataset.t;
    MID = null;
    V = { l: null, p: null };
  } else if (a == "goHome") {
    T = S.co.done ? "h" : "co";
    MID = null;
    V = { l: null, p: null };
  } else if (a == "editCo") {
    T = "co";
  } else if (a == "addDept") {
    S.co.depts.push({ id: id(), name: "" });
    save();
    R(true);
    const ins = document.querySelectorAll("[data-dept]");
    ins[ins.length - 1].focus();
    return;
  } else if (a == "rmDept") {
    const d = S.co.depts[i],
      used = [...S.machines, ...S.lines.flatMap((l) => l.products)].some(
        (p) => deptOf(p, S.co) == d.id,
      );
    if (
      used &&
      !confirm(
        `Remove "${d.name}"? Products and machines using it will have no department.`,
      )
    )
      return;
    // Pin older items to their current department before the list changes.
    [...S.machines, ...S.lines.flatMap((l) => l.products)].forEach((p) => {
      if (p.dept === undefined) p.dept = deptOf(p, S.co);
    });
    S.co.depts.splice(i, 1);
  } else if (a == "coDone") {
    if (!S.co.name.trim()) {
      $("#coErr").hidden = false;
      $("[data-co=name]").focus();
      return;
    }
    // Drop empty departments, pinning older items to their department first.
    [...S.machines, ...S.lines.flatMap((l) => l.products)].forEach((p) => {
      if (p.dept === undefined) p.dept = deptOf(p, S.co);
    });
    S.co.depts = S.co.depts.filter((d) => d.name.trim());
    S.co.done = true;
    Store.persist();
    T = "h";
  } else if (a == "mhome") {
    MID = null;
  } else if (a == "openM") {
    MID = t.dataset.id;
  } else if (a == "addM") {
    if (!nw || !nw.trim()) return;
    const m = {
      id: id(),
      name: nw.trim(),
      dept: (S.co.depts.find((d) => d.name.trim()) || {}).id || "",
      code: "",
      rev: "1",
      date: new Date().toISOString().slice(0, 10),
      prod: [],
      pack: [],
      steps: [{ t: "", img: "" }],
      by: "",
      appr: "",
    };
    S.machines.push(m);
    MID = m.id;
  } else if (a == "bk") {
    exportZip(
      planBackup(S),
      `setup-procedures-backup-${dateStamp()}.zip`,
      t,
      () => {
        S.lastBackup = Date.now();
        save();
        if (T == "h") R(true);
      },
    );
    return;
  } else if (a == "exLine") {
    const l = L(),
      list = lineItems(S, l.id);
    if (!list.length) return alert("This line has no products yet.");
    exportZip(
      planItems(list),
      `${safeName(l.name, "Line")} - line - ${dateStamp()}.zip`,
      t,
    );
    return;
  } else if (a == "goX") {
    T = "x";
    EXS = new Set(allKeys("x"));
    IMP = null;
    XMSG = "";
    XF = "";
  } else if (a == "tgl") {
    COL.has(t.dataset.g) ? COL.delete(t.dataset.g) : COL.add(t.dataset.g);
    R(true);
    $(`[data-a=tgl][data-g="${CSS.escape(t.dataset.g)}"]`).focus();
    return;
  } else if (a == "xfClear") {
    XF = "";
    R(true);
    $("[data-xf]").focus();
    return;
  } else if (a == "xExport") {
    exportSelected(t);
    return;
  } else if (a == "iDo") {
    applyImport();
    return;
  } else if (a == "iCancel") {
    IMP = null;
    R(true);
    return;
  } else if (a == "exItem") {
    const p = P(),
      kind = T == "m" ? "machine" : "product";
    exportZip(
      planItems([
        {
          p,
          kind,
          line: kind == "product" ? L().name : "",
          dept: deptName(deptOf(p, S.co), S.co),
        },
      ]),
      `${safeName(p.name, kind)} - ${kind} - ${dateStamp()}.zip`,
      t,
    );
    return;
  } else if (a == "clearAll") {
    if (
      !confirm(
        "Delete ALL lines, products, steps and photos saved in this browser? This cannot be undone.",
      )
    )
      return;
    S = {
      lines: [],
      machines: [],
      co: { name: "", depts: [{ id: id(), name: "" }] },
    };
    T = "co";
    MID = null;
    V = { l: null, p: null };
  } else if (a == "pdf") {
    return mkPdf();
  }
  save();
  R(/^(rmPh|addS|rmS|rmSI|up|dn)$/.test(a));
});

document.addEventListener("input", (e) => {
  const t = e.target;
  if (t.dataset.xf) {
    XF = t.value;
    const pos = t.selectionStart;
    R(true);
    const f = $("[data-xf]");
    f.focus();
    f.setSelectionRange(pos, pos);
    return;
  }
  if (t.dataset.co) {
    S.co[t.dataset.co] = t.value;
    save();
    return;
  }
  if (t.dataset.dept !== undefined) {
    S.co.depts[+t.dataset.dept].name = t.value;
    save();
    return;
  }
  const p = P();
  if (!p) return;
  if (t.dataset.f) p[t.dataset.f] = t.value;
  else if (t.dataset.s !== undefined) p.steps[+t.dataset.s].t = t.value;
  else if (t.dataset.h !== undefined) p.steps[+t.dataset.h].h = t.value;
  else return;
  save();
});

document.addEventListener("change", async (e) => {
  const t = e.target;
  if (t.dataset.logo) {
    const f = t.files[0];
    if (!f) return;
    const d = await comp(f, true, 1000);
    t.value = "";
    if (!d) return alert(BAD_IMG);
    const prev = S.logo;
    S.logo = d;
    if (!(await writeNow())) S.logo = prev;
    R(true);
    return;
  }
  if (t.dataset.imp) {
    const files = [...t.files];
    t.value = "";
    if (files.length) await loadImport(files);
    return;
  }
  // Tree tick boxes: a single item (data-k) or a whole group (data-g).
  if (t.dataset.ck || t.dataset.cg) {
    const m = t.dataset.ck || t.dataset.cg,
      set = m == "x" ? EXS : IMP.sel,
      keys = t.dataset.ck
        ? [t.dataset.k]
        : (m == "x" ? exGroup : impGroup)(t.dataset.g),
      sel = t.dataset.ck
        ? `[data-ck="${m}"][data-k="${CSS.escape(t.dataset.k)}"]`
        : `[data-cg="${m}"][data-g="${CSS.escape(t.dataset.g)}"]`;
    keys.forEach((k) => (t.checked ? set.add(k) : set.delete(k)));
    R(true);
    const el = $(sel);
    if (el) el.focus();
    return;
  }
  if (t.name == "grp") {
    GRP = t.value;
    R(true);
    $(`input[name="grp"][value="${t.value}"]`).focus();
    return;
  }
  if (t.name == "imode" || t.name == "iclash") {
    IMP[t.name == "imode" ? "mode" : "clash"] = t.value;
    R(true);
    $(`input[name="${t.name}"][value="${t.value}"]`).focus();
    return;
  }
  if (!t.dataset.up) return;
  const p = P(),
    k = t.dataset.up,
    si = +t.dataset.i,
    files = [...t.files];
  t.value = "";
  // Add and save photos one at a time; if storage fills up, keep the ones
  // that fit and undo the one that did not.
  for (const f of files) {
    const d = await comp(f);
    if (!d) {
      alert(BAD_IMG);
      continue;
    }
    const before = k == "step" ? p.steps[si].img : null;
    if (k == "step") p.steps[si].img = d;
    else p[k].push(d);
    if (!(await writeNow())) {
      if (k == "step") p.steps[si].img = before;
      else p[k].pop();
      break;
    }
  }
  R(true);
});

// ---------- Export and import (.zip, or older .json backups) ----------

// Image data -> bytes, and bytes -> image data.
const dataToBytes = (d) => {
  const b = atob(d.slice(d.indexOf(",") + 1)),
    u = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
  return u;
};
const bytesToData = (bytes, type) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(new Blob([bytes], { type }));
  });
// Image type from the file's first bytes (a replaced photo may have any name).
const sniff = (b) =>
  b[0] == 0xff && b[1] == 0xd8
    ? "image/jpeg"
    : b[0] == 0x89 && b[1] == 0x50
      ? "image/png"
      : b[0] == 0x52 && b[8] == 0x57
        ? "image/webp"
        : b[0] == 0x47 && b[1] == 0x49
          ? "image/gif"
          : b[0] == 0x3c || (b[0] == 0xef && b[3] == 0x3c)
            ? "image/svg+xml"
            : "";

// plan: { data, files } from planBackup() or planItems().
async function exportZip(plan, name, btn, done) {
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Exporting…";
  try {
    const files = [
      {
        name: "data.json",
        data: new TextEncoder().encode(JSON.stringify(plan.data, null, 1)),
      },
    ];
    for (const [p, d] of plan.files)
      files.push({ name: p, data: dataToBytes(d) });
    await dl(name, Zip.make(files));
    if (done) done();
  } catch (e) {
    alert("Could not create the export file.");
  } finally {
    btn.disabled = false;
    btn.textContent = label;
  }
}

// Read one .zip or .json file -> { data, missing } (data null if unreadable).
async function readFile(f) {
  let data = null,
    missing = 0;
  try {
    const buf = await f.arrayBuffer();
    if (Zip.isZip(buf)) {
      const z = await Zip.read(buf),
        key = [...z.keys()].find(
          (k) => /(^|\/)data\.json$/i.test(k) && !k.startsWith("__MACOSX"),
        );
      if (!key) throw 0;
      // The ZIP may have been re-saved inside a folder: paths are relative to data.json.
      const root = key.slice(0, -"data.json".length),
        raw = JSON.parse(new TextDecoder().decode(z.get(key))),
        imgs = new Map();
      for (const p of imgPaths(raw)) {
        const b = z.get(root + p);
        if (!b) continue;
        const type = sniff(b),
          logo = p == raw.logo;
        // Photos must be JPEG and the logo PNG or JPEG for the PDF; convert others.
        let d =
          type == "image/jpeg" || (logo && type == "image/png")
            ? await bytesToData(b, type)
            : null;
        if (!d && type)
          d = await comp(new Blob([b], { type }), logo, logo ? 1000 : 2000);
        if (d) imgs.set(p, d);
      }
      ({ data, missing } = restoreImgs(raw, imgs));
    } else data = JSON.parse(new TextDecoder().decode(buf));
  } catch (e) {
    data = null;
  }
  return { data, missing };
}

// ---------- Export & import page ----------

const ACCEPT_IMP = ".zip,.json,application/zip,application/json";
const imgBytes = (p) =>
  [...(p.prod || []), ...(p.pack || []), ...(p.steps || []).map((s) => s.img)]
    .filter(Boolean)
    .reduce((a, v) => a + v.length * 0.75, 0);
const itemSub = (p, dept) =>
  [p.code, dept]
    .filter((x) => String(x || "").trim())
    .map(esc)
    .join(" · ");
const count = (n, one, many) => `${n} ${n == 1 ? one : many}`;

// Tree items. Export keys: "co" company details, "p:<id>" product, "m:<id>"
// machine. Import keys: "co" company details, "i:<n>" the n-th item in the files.
const lineKey = (n) => (String(n || "").trim() || "Imported").toLowerCase();
const exItems = () => [
  ...S.lines.flatMap((l) =>
    l.products.map((p) => ({
      key: "p:" + p.id,
      kind: "product",
      p,
      line: l.name,
      lk: "l" + l.id,
      dept: deptName(deptOf(p, S.co), S.co),
    })),
  ),
  ...S.machines.map((p) => ({
    key: "m:" + p.id,
    kind: "machine",
    p,
    line: "",
    lk: "",
    dept: deptName(deptOf(p, S.co), S.co),
  })),
];
const impItems = () =>
  IMP
    ? IMP.packs.map((pk, i) => ({
        key: "i:" + i,
        kind: pk.kind,
        p: pk.item,
        line: String(pk.line || "").trim() || "Imported",
        lk: lineKey(pk.line),
        dept: String(pk.dept || "").trim(),
        exists: findExisting(S, pk),
      }))
    : [];
const itemsOf = (mode) => (mode == "x" ? exItems() : impItems());
const company = (mode) =>
  mode == "x" ? { name: S.co.name, depts: [] } : IMP && IMP.company;
// All keys, ignoring the filter (for "everything ticked" and initial ticks).
const allKeys = (mode) => [
  ...(company(mode) ? ["co"] : []),
  ...itemsOf(mode).map((x) => x.key),
];

// Filter: matches name, code, product line, department or kind.
const fq = () => XF.trim().toLowerCase();
const shown = (it) =>
  !fq() ||
  [it.p.name, it.p.code, it.line, it.dept, it.kind].some((v) =>
    String(v || "")
      .toLowerCase()
      .includes(fq()),
  );
const coShown = (c) =>
  !!c &&
  (!fq() || ("company details logo " + c.name).toLowerCase().includes(fq()));
const deptKey = (it) => "dept:" + it.dept.toLowerCase();

// Keys in a group, counting only items the filter shows.
function groupKeys(mode, g) {
  const items = itemsOf(mode).filter(shown),
    pick = (f) => items.filter(f).map((x) => x.key);
  if (g == "all")
    return [...(coShown(company(mode)) ? ["co"] : []), ...pick(() => true)];
  if (g == "products") return pick((x) => x.kind == "product");
  if (g == "machines") return pick((x) => x.kind == "machine");
  if (g.startsWith("line:"))
    return pick((x) => x.kind == "product" && "line:" + x.lk == g);
  if (g.startsWith("dept:")) return pick((x) => deptKey(x) == g);
  return [];
}
const exGroup = (g) => groupKeys("x", g),
  impGroup = (g) => groupKeys("i", g);

// Tree nodes, grouped by product line or by department (GRP).
function treeNodes(mode) {
  const items = itemsOf(mode).filter(shown),
    c = company(mode),
    kids = [];
  const leaf = (it) => ({
    key: it.key,
    label: esc(it.p.name || "Untitled"),
    sub:
      GRP == "dept"
        ? [it.kind == "machine" ? "Machine" : "Product · " + it.line, it.p.code]
            .filter((x) => String(x || "").trim())
            .map(esc)
            .join(" · ")
        : itemSub(it.p, it.dept),
    badge:
      mode == "i"
        ? it.exists
          ? `<span class="bd">already exists</span>`
          : `<span class="bd new">new</span>`
        : "",
  });
  const mix = (list) => {
    const np = list.filter((x) => x.kind == "product").length,
      nm = list.length - np;
    return [
      np && count(np, "product", "products"),
      nm && count(nm, "machine", "machines"),
    ]
      .filter(Boolean)
      .join(" · ");
  };
  if (coShown(c))
    kids.push({
      key: "co",
      label: "Company details and logo",
      sub: esc([c.name, ...(c.depts || [])].filter(Boolean).join(" · ")),
    });
  if (GRP == "dept") {
    // Departments in the company's order (export), then as found; "No department" last.
    const groups = new Map();
    if (mode == "x")
      S.co.depts
        .filter((d) => d.name.trim())
        .forEach((d) =>
          groups.set("dept:" + d.name.toLowerCase(), {
            name: d.name,
            items: [],
          }),
        );
    for (const it of items) {
      const k = deptKey(it);
      if (!groups.has(k)) groups.set(k, { name: it.dept, items: [] });
      groups.get(k).items.push(it);
    }
    const none = groups.get("dept:");
    groups.delete("dept:");
    if (none) groups.set("dept:", none);
    for (const [k, gr] of groups)
      if (gr.items.length)
        kids.push({
          group: k,
          label: gr.name ? esc(gr.name) : "<i>No department</i>",
          sub: mix(gr.items),
          children: gr.items.map(leaf),
        });
  } else {
    const lines = new Map();
    if (mode == "x" && !fq())
      S.lines.forEach((l) =>
        lines.set("l" + l.id, { name: l.name, items: [] }),
      );
    for (const it of items.filter((x) => x.kind == "product")) {
      if (!lines.has(it.lk)) lines.set(it.lk, { name: it.line, items: [] });
      lines.get(it.lk).items.push(it);
    }
    const np = items.filter((x) => x.kind == "product").length,
      machs = items.filter((x) => x.kind == "machine");
    if (np || (mode == "x" && !fq()))
      kids.push({
        group: "products",
        label: "Products",
        sub: `${count(lines.size, "line", "lines")} · ${count(np, "product", "products")}`,
        children: [...lines].map(([k, l]) => ({
          group: "line:" + k,
          label: esc(l.name),
          sub: count(l.items.length, "product", "products"),
          children: l.items.map(leaf),
        })),
      });
    if (machs.length || (mode == "x" && !fq()))
      kids.push({
        group: "machines",
        label: "Machines",
        sub: count(machs.length, "machine", "machines"),
        children: machs.map(leaf),
      });
  }
  const top =
    mode == "x"
      ? {
          label: "<b>Everything</b>",
          sub: fq() ? "items matching the filter" : "full backup",
        }
      : {
          label:
            "<b>Everything in the file" +
            (IMP.names.length > 1 ? "s" : "") +
            "</b>",
          sub: fq() ? "items matching the filter" : "",
        };
  if (!kids.length) return [];
  return [{ group: "all", ...top, children: kids }];
}

// Tree with tick boxes. Node: { key } for an item, or { group, children } for a
// group. A group is ticked when all its items are, and shows a dash when some are.
function tree(nodes, mode, sel, groupFn, disabled) {
  const node = (n) => {
    const keys = n.group ? groupFn(n.group) : [n.key],
      on = keys.length > 0 && keys.every((k) => sel.has(k)),
      some = keys.some((k) => sel.has(k)),
      kids = n.children || [],
      cg = mode + "|" + n.group,
      open = !COL.has(cg),
      box = `<input type="checkbox" ${n.group ? `data-cg="${mode}" data-g="${esc(n.group)}"` : `data-ck="${mode}" data-k="${esc(n.key)}"`}${on ? " checked" : ""}${!on && some ? ' data-ind="1"' : ""}${disabled || !keys.length ? " disabled" : ""}>`,
      tg = kids.length
        ? `<button class="tg" data-a="tgl" data-g="${esc(cg)}" aria-expanded="${open}" aria-label="${open ? "Collapse" : "Expand"}">${open ? "▾" : "▸"}</button>`
        : `<span class="tg"></span>`;
    return `<li><div class="tr">${tg}<label>${box}<span>${n.label}</span>${n.sub ? `<span class="m">${n.sub}</span>` : ""}${n.badge || ""}</label></div>${kids.length && open ? `<ul>${kids.map(node).join("")}</ul>` : ""}</li>`;
  };
  return nodes.length
    ? `<ul class="tree">${nodes.map(node).join("")}</ul>`
    : "";
}

// Filter box and "Group by" switch; they apply to both trees on the page.
function toolbar() {
  const total = exItems().length + (IMP ? IMP.packs.length : 0),
    hits = exItems().filter(shown).length + impItems().filter(shown).length;
  return (
    `<div class="xbar"><input type="search" data-xf="1" value="${esc(XF)}" placeholder="Filter by name, code, line or department" aria-label="Filter the lists"><div class="radios seg" role="radiogroup" aria-label="Group by"><span class="m">Group by</span><label><input type="radio" name="grp" value="line"${GRP == "line" ? " checked" : ""}> Product line</label><label><input type="radio" name="grp" value="dept"${GRP == "dept" ? " checked" : ""}> Department</label></div></div>` +
    (fq()
      ? `<p class="m" role="status">Showing ${hits} of ${count(total, "item", "items")}. Ticking a group ticks only the items shown; hidden items keep their ticks. <button class="lk" data-a="xfClear">Clear filter</button></p>`
      : "")
  );
}

function XV() {
  // Export summary
  const prods = S.lines
      .flatMap((l) => l.products)
      .filter((p) => EXS.has("p:" + p.id)),
    machs = S.machines.filter((m) => EXS.has("m:" + m.id)),
    co = EXS.has("co"),
    all = allKeys("x").every((k) => EXS.has(k)),
    bytes =
      [...prods, ...machs].reduce((a, p) => a + imgBytes(p), 0) +
      (co && S.logo ? S.logo.length * 0.75 : 0),
    picked = [
      prods.length && count(prods.length, "product", "products"),
      machs.length && count(machs.length, "machine", "machines"),
      co && "company details",
    ].filter(Boolean);
  let h =
    `<button class="lk" data-a="goHome">← Home</button><h1>Export &amp; import</h1>` +
    (XMSG ? `<p class="ok" role="status">${XMSG}</p>` : "") +
    `<h2>Export</h2><p class="m">Tick what to export. With everything ticked you get a full backup.</p>` +
    toolbar() +
    (tree(treeNodes("x"), "x", EXS, exGroup, false) || `<p class="m">Nothing matches the filter.</p>`) +
    `<p class="m" role="status">${picked.length ? `Selected: ${picked.join(", ")}${all ? " (full backup)" : ""} · about ${fmtBytes(bytes + 2048)}` : "Nothing selected."}</p>
<div class="row"><button class="b" data-a="xExport"${picked.length ? "" : " disabled"}>${all ? "Export full backup" : "Export selected"}</button></div>`;

  h += `<h2 id="imp">Import</h2>`;
  if (!IMP) {
    h += `<p class="m">Choose one or more .zip files (or older .json backups). You will see what is inside and can tick what to import.</p><label class="b2">Choose files<input type="file" accept="${ACCEPT_IMP}" multiple hidden data-imp="1"></label>`;
    return h;
  }
  const notes = [];
  if (IMP.bad.length)
    notes.push(
      `Not a valid backup or export, skipped: ${esc(IMP.bad.join(", "))}`,
    );
  if (IMP.missing)
    notes.push(
      `${count(IMP.missing, "photo was", "photos were")} not found in the file${IMP.names.length > 1 ? "s" : ""} and will be left empty.`,
    );
  h +=
    `<p class="m">From: <b>${esc(IMP.names.join(", "))}</b></p>` +
    notes.map((n) => `<p class="err">${n}</p>`).join("");
  if (!IMP.packs.length && !IMP.company) {
    return (
      h +
      `<div class="row"><button class="b2" data-a="iCancel">Choose other files</button></div>`
    );
  }
  if (IMP.full)
    h += `<div class="radios"><label><input type="radio" name="imode" value="replace"${IMP.mode == "replace" ? " checked" : ""}> Replace all current data with this backup</label><label><input type="radio" name="imode" value="merge"${IMP.mode == "merge" ? " checked" : ""}> Add only what I tick below to the current data</label></div>`;
  const merge = IMP.mode == "merge";
  h +=
    tree(treeNodes("i"), "i", IMP.sel, impGroup, !merge) ||
    `<p class="m">Nothing in the file matches the filter.</p>`;
  if (merge)
    h += `<p class="m">When an item already exists:</p><div class="radios"><label><input type="radio" name="iclash" value="replace"${IMP.clash == "replace" ? " checked" : ""}> Replace it with the imported one</label><label><input type="radio" name="iclash" value="keep"${IMP.clash == "keep" ? " checked" : ""}> Keep both (the imported one gets "(imported)")</label></div>`;
  return (
    h +
    `<div class="row" style="flex-wrap:wrap"><button class="b" data-a="iDo">${merge ? "Import selected" : "Replace all data"}</button><button class="b2" data-a="iCancel">Cancel</button></div>`
  );
}

async function exportSelected(btn) {
  const list = [
      ...S.lines.flatMap((l) =>
        l.products
          .filter((p) => EXS.has("p:" + p.id))
          .map((p) => ({
            p,
            kind: "product",
            line: l.name,
            dept: deptName(deptOf(p, S.co), S.co),
          })),
      ),
      ...S.machines
        .filter((m) => EXS.has("m:" + m.id))
        .map((p) => ({
          p,
          kind: "machine",
          line: "",
          dept: deptName(deptOf(p, S.co), S.co),
        })),
    ],
    co = EXS.has("co");
  if (!list.length && !co) return alert("Tick at least one thing to export.");
  if (allKeys("x").every((k) => EXS.has(k)))
    return exportZip(
      planBackup(S),
      `setup-procedures-backup-${dateStamp()}.zip`,
      btn,
      () => {
        S.lastBackup = Date.now();
        save();
      },
    );
  const one = list.length == 1 && !co;
  exportZip(
    planItems(list, co ? { co: S.co, logo: S.logo } : null),
    one
      ? `${safeName(list[0].p.name, list[0].kind)} - ${list[0].kind} - ${dateStamp()}.zip`
      : `setup-procedures-export-${dateStamp()}.zip`,
    btn,
  );
}

// Read the chosen files and show what is in them on the Export & import page.
async function loadImport(files) {
  document.body.style.cursor = "progress";
  const read = [];
  try {
    for (const f of files) read.push({ name: f.name, ...(await readFile(f)) });
  } finally {
    document.body.style.cursor = "";
  }
  const packs = [],
    bad = [],
    fulls = [];
  let company = null,
    missing = 0;
  for (const r of read) {
    const c = fileContents(r.data);
    if (!c) {
      bad.push(r.name);
      continue;
    }
    packs.push(...c.packs);
    if (c.company && !company) company = c.company;
    if (c.full) fulls.push(c.full);
    missing += r.missing;
  }
  const full = read.length == 1 && fulls.length == 1 ? fulls[0] : null;
  IMP = {
    names: read.map((r) => r.name),
    packs,
    company,
    full,
    bad,
    missing,
    mode: full ? "replace" : "merge",
    clash: "replace",
    sel: new Set(),
  };
  allKeys("i").forEach((k) => IMP.sel.add(k));
  // Company details from a full backup are not ticked by default when adding.
  if (fulls.length) IMP.sel.delete("co");
  if (T != "x") EXS = new Set(allKeys("x"));
  XMSG = "";
  T = "x";
  R(true);
  const el = $("#imp");
  if (el) el.scrollIntoView({ block: "start" });
}

async function applyImport() {
  let msg;
  if (IMP.mode == "replace" && IMP.full) {
    if (
      !confirm(
        "Replace ALL current data with this backup? This cannot be undone.",
      )
    )
      return;
    S = IMP.full;
    S.lastBackup = Date.now(); // this data is already in a backup file
    msg = "All data was replaced with the backup.";
  } else {
    const chosen = IMP.packs.filter((_, i) => IMP.sel.has("i:" + i)),
      co = IMP.company && IMP.sel.has("co");
    if (!chosen.length && !co)
      return alert("Tick at least one thing to import.");
    if (co) mergeCompany(S, IMP.company);
    const res = chosen.map((pk) =>
        addItem(S, pk, () => IMP.clash == "replace"),
      ),
      rep = res.filter((r) => r.replaced).length;
    msg =
      [
        res.length - rep && `${count(res.length - rep, "item", "items")} added`,
        rep && `${rep} replaced`,
        co && "company details updated",
      ]
        .filter(Boolean)
        .join(", ") + ".";
    msg = msg[0].toUpperCase() + msg.slice(1);
  }
  // Finishing the company setup when importing from the Welcome screen.
  if (!S.co.done && S.co.name.trim()) {
    S.co.depts = S.co.depts.filter((d) => d.name.trim());
    S.co.done = true;
  }
  if (!(await writeNow())) return;
  IMP = null;
  XMSG = esc(msg);
  EXS = new Set(allKeys("x"));
  R();
}

async function dl(name, data) {
  try {
    const D = await claude.use("downloads");
    if (!D) throw 0;
    await D.save({ filename: name, data });
  } catch (e) {
    if (e && e.code == "declined") return;
    try {
      const u = URL.createObjectURL(
          data instanceof Blob ? data : new Blob([data]),
        ),
        a = document.createElement("a");
      a.href = u;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(u), 5000);
    } catch (x) {
      alert("Could not save the file.");
    }
  }
}
async function mkPdf() {
  const p = P();
  if (!p.by.trim() || !p.appr.trim()) {
    alert('Enter both "Prepared by" and "Approved by" before downloading.');
    return;
  }
  const d = new window.jspdf.jsPDF({ unit: "mm", format: "a4" }),
    W = 210,
    M = 18,
    B = 275,
    CW = W - 2 * M;
  let y = M;
  const G = [110, 110, 110],
    K = [0, 0, 0],
    LN = [200, 200, 200];
  const tc = (c) => d.setTextColor(c[0], c[1], c[2]);
  const need = (h) => {
    if (y + h > B) {
      d.addPage();
      y = M + 4;
    }
  };
  const fit = (s, mw, mh) => {
    const q = d.getImageProperties(s);
    let w = mw,
      h = (w * q.height) / q.width;
    if (h > mh) {
      h = mh;
      w = (h * q.width) / q.height;
    }
    return [w, h];
  };
  const sec = (t) => {
    need(16);
    y += 5;
    d.setFont("helvetica", "bold");
    d.setFontSize(11);
    tc(K);
    d.text(t, M, y);
    y += 2.5;
    d.setDrawColor(...LN);
    d.setLineWidth(0.2);
    d.line(M, y, W - M, y);
    y += 5;
  };
  const para = (t, x, w, sz, bd, col) => {
    d.setFont("helvetica", bd ? "bold" : "normal");
    d.setFontSize(sz);
    tc(col || K);
    const lh = sz * 0.46;
    for (const l of d.splitTextToSize(t, w)) {
      need(lh + 1);
      d.text(l, x, y + lh * 0.8);
      y += lh;
    }
  };
  const box = (s, x, w, h) => {
    d.addImage(s, "JPEG", x, y, w, h);
    d.setDrawColor(...LN);
    d.setLineWidth(0.2);
    d.rect(x, y, w, h);
  };
  const gal = (arr) => {
    let x = M,
      rh = 0;
    for (const s of arr) {
      const [w, h] = fit(s, 54, 42);
      if (x + w > W - M + 0.1) {
        x = M;
        y += rh + 4;
        rh = 0;
      }
      if (y + h > B) {
        d.addPage();
        y = M + 4;
        x = M;
        rh = 0;
      }
      box(s, x, w, h);
      x += w + 5;
      rh = Math.max(rh, h);
    }
    y += rh + 4;
  };
  d.setFont("helvetica", "normal");
  d.setFontSize(9);
  tc(G);
  // Company logo at the top right; the title wraps before reaching it.
  let lw = 0,
    lh = 0;
  if (S.logo) {
    [lw, lh] = fit(S.logo, 45, 18);
    d.addImage(S.logo, "PNG", W - M - lw, M, lw, lh);
  }
  // Top line: company · department · Setup procedure
  const top = [S.co.name, deptName(deptOf(p, S.co), S.co), "Setup procedure"]
    .map((x) => String(x || "").trim())
    .filter(Boolean)
    .join("  ·  ");
  d.text(d.splitTextToSize(top, CW - (lw ? lw + 6 : 0))[0], M, y + 3);
  y += 8;
  para(p.name || "Untitled", M, CW - (lw ? lw + 6 : 0), 20, 1);
  y = Math.max(y + 4, M + lh + 4);
  const mm = T == "m",
    meta = [
      mm ? ["Type", "Machine"] : ["Line", L().name],
      [mm ? "Asset ID" : "Product code", p.code || "-"],
      ["Revision", p.rev || "-"],
      ["Date", p.date || "-"],
    ],
    cw = CW / 4;
  meta.forEach(([k, v], i) => {
    const x = M + i * cw;
    d.setFont("helvetica", "normal");
    d.setFontSize(8);
    tc(G);
    d.text(k, x, y + 3);
    d.setFont("helvetica", "bold");
    d.setFontSize(10);
    tc(K);
    d.text(d.splitTextToSize(String(v), cw - 4)[0], x, y + 8.5);
  });
  y += 13;
  d.setDrawColor(...K);
  d.setLineWidth(0.5);
  d.line(M, y, W - M, y);
  y += 1;
  if (p.prod.length) {
    sec(mm ? "Machine photos" : "Product photos");
    gal(p.prod);
  }
  if (p.pack.length) {
    sec(mm ? "Control panel / nameplate photos" : "Packaging photos");
    gal(p.pack);
  }
  sec("Procedure");
  // Height of wrapped text, matching para() below.
  const textH = (t, w, sz, bd) => {
    d.setFont("helvetica", bd ? "bold" : "normal");
    d.setFontSize(sz);
    return d.splitTextToSize(t, w).length * sz * 0.46;
  };
  p.steps.forEach((s, i) => {
    // Keep a step's headline, text and photo together on one page when they
    // fit on a page; otherwise start it on a new page if it is near the bottom.
    let sh = 0;
    if (s.h) sh += textH(s.h, CW - 9, 11.5, 1) + 1;
    if (s.t) sh += textH(s.t, CW - 9, 10.5, 0);
    if (s.img) sh += 2 + fit(s.img, 100, 75)[1];
    sh = Math.max(sh, 7);
    need(sh <= B - (M + 4) ? sh : 16);
    const y0 = y,
      pg = d.getNumberOfPages();
    d.setFont("helvetica", "bold");
    d.setFontSize(12);
    tc(K);
    d.text(i + 1 + ".", M, y + 4.5);
    if (s.h) {
      para(s.h, M + 9, CW - 9, 11.5, 1);
      y += 1;
    }
    if (s.t) para(s.t, M + 9, CW - 9, 10.5, 0, [45, 45, 45]);
    if (s.img) {
      y += 2;
      const [w, h] = fit(s.img, 100, 75);
      need(h + 1);
      box(s.img, M + 9, w, h);
      y += h;
    }
    // Minimum step height, only if the step did not run onto a new page.
    if (d.getNumberOfPages() == pg && y < y0 + 7) y = y0 + 7;
    y += 6;
  });
  y += 4;
  need(88);
  y += 4;
  sec("Approval");
  // Time and technicians table: values printed when entered, otherwise the
  // cell is left blank to write in by pen ("h" and "min" guides for time).
  const mins = toMinutes(p.th, p.tm),
    tech = String(p.tech ?? "").trim(),
    tw = CW / 2,
    th = 8,
    tv = 12;
  d.setDrawColor(...K);
  d.setLineWidth(0.3);
  [
    ["Time required", mins == null ? "" : fmtTime(mins), true],
    ["Technicians required", tech, false],
  ].forEach(([lb, v, isTime], i) => {
    const x = M + i * tw;
    d.rect(x, y, tw, th);
    d.rect(x, y + th, tw, tv);
    d.setFont("helvetica", "bold");
    d.setFontSize(9);
    tc(K);
    d.text(lb, x + 2, y + 5.4);
    if (v) {
      d.setFontSize(12);
      d.text(v, x + 2, y + th + 7.8);
    } else if (isTime) {
      d.setFont("helvetica", "normal");
      d.setFontSize(9);
      tc(G);
      d.text("h", x + 26, y + th + tv - 3);
      d.text("min", x + 58, y + th + tv - 3);
    }
  });
  y += th + tv + 8;
  const c2 = (CW - 10) / 2;
  [
    ["Prepared by", p.by, M],
    ["Approved by", p.appr, M + c2 + 10],
  ].forEach(([lb, nm, x]) => {
    d.setFont("helvetica", "normal");
    d.setFontSize(8);
    tc(G);
    d.text(lb, x, y + 3);
    d.setFont("helvetica", "bold");
    d.setFontSize(12);
    tc(K);
    d.text(d.splitTextToSize(nm, c2)[0], x, y + 10);
    d.setDrawColor(...K);
    d.setLineWidth(0.3);
    d.line(x, y + 24, x + c2, y + 24);
    d.setFont("helvetica", "normal");
    d.setFontSize(8);
    tc(G);
    d.text("Signature", x, y + 28);
    d.text("Date", x + c2 * 0.65, y + 28);
  });
  y += 36;
  const n = d.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    d.setPage(i);
    d.setDrawColor(...LN);
    d.setLineWidth(0.2);
    d.line(M, 284, W - M, 284);
    d.setFont("helvetica", "normal");
    d.setFontSize(8);
    tc(G);
    d.text((p.name || "") + "  Rev " + (p.rev || "-"), M, 289);
    d.text("Page " + i + " of " + n, W - M, 289, { align: "right" });
  }
  await dl(
    (p.name || "setup-procedure").replace(/[^\w-]+/g, "_") +
      "_rev" +
      (p.rev || "1") +
      ".pdf",
    d.output("blob"),
  );
}
// Start: load saved data, then show the first screen.
Store.load().then((d) => {
  initState(d);
  R();
});
