// Setup Procedures app: state, rendering, event handling and PDF export.
// Helpers (id, esc, tot, parseBackup) come from js/utils.js, loaded first.
const $ = (s) => document.querySelector(s);
let S = { lines: [] };
try {
  S = JSON.parse(localStorage.getItem("sp") || "") || S;
} catch (e) {}
S.machines = S.machines || [];
S.lines = S.lines || [];
let V = { l: null, p: null },
  T = "p",
  MID = null;
const save = () => {
  try {
    localStorage.setItem("sp", JSON.stringify(S));
  } catch (e) {
    alert("Browser storage is full. Remove some photos or products.");
  }
};
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

const bkp = () =>
  `<h2>Backup</h2><p class="m">Save a copy of everything, or restore one.</p><div class="row" style="flex-wrap:wrap"><button class="b2" data-a="bk">Export backup</button><label class="b2">Import backup<input type="file" accept=".json,application/json" hidden data-imp="1"></label></div><div style="margin-top:24px"><button class="b d" data-a="clearAll">Clear all saved data</button></div>`;
const TABS = () =>
  `<div class="tabs"><button class="${T == "p" ? "on" : ""}" data-a="tab" data-t="p">Products</button><button class="${T == "m" ? "on" : ""}" data-a="tab" data-t="m">Machines</button></div>`;
const MV = () =>
  TABS() +
  `<h1>Machines</h1><p class="m">Pick a machine, or add one.</p>` +
  S.machines
    .map(
      (m) =>
        `<div class="card" data-a="openM" data-id="${m.id}"><b>${esc(m.name)}</b><span class="m">${esc(m.code)} · ${m.steps.length} step${m.steps.length == 1 ? "" : "s"}</span></div>`,
    )
    .join("") +
  add("Machine name", "addM") +
  bkp();
function R(keep) {
  let h = "";
  if (T == "m" && !MID) {
    h = MV();
  } else if (T == "p" && !V.l) {
    h =
      TABS() +
      `<h1>Setup procedures</h1><p class="m">Pick a product line, or add one.</p>` +
      S.lines
        .map(
          (l) =>
            `<div class="card" data-a="openL" data-id="${l.id}"><b>${esc(l.name)}</b><span class="m">${l.products.length} product${l.products.length == 1 ? "" : "s"}</span></div>`,
        )
        .join("") +
      add("Line name, e.g. Line 1", "addL") +
      bkp();
  } else if (T == "p" && !V.p) {
    const l = L();
    h =
      `<button class="lk" data-a="home">← All lines</button><h1>${esc(l.name)}</h1><p class="m">Pick a product, or add one.</p>` +
      l.products
        .map(
          (p) =>
            `<div class="card" data-a="openP" data-id="${p.id}"><b>${esc(p.name)}</b><span class="m">${esc(p.code)} · ${p.steps.length} step${p.steps.length == 1 ? "" : "s"}</span></div>`,
        )
        .join("") +
      add("Product name", "addP") +
      `<button class="b d" data-a="delL">Delete this line</button>`;
  } else {
    const p = P(),
      mm = T == "m";
    h =
      (mm
        ? `<button class="lk" data-a="mhome">← All machines</button>`
        : `<button class="lk" data-a="openL" data-id="${V.l}">← ${esc(L().name)}</button>`) +
      `<h1>${esc(p.name) || (mm ? "New machine" : "New product")}</h1>
<label class="f">${mm ? "Machine name" : "Product name"}<input data-f="name" value="${esc(p.name)}"></label>
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
<h2>Sign-off</h2><div class="two"><label class="f">Prepared by<input data-f="by" value="${esc(p.by)}"></label><label class="f">Approved by<input data-f="appr" value="${esc(p.appr)}"></label></div>
<label class="f">Date<input type="date" data-f="date" value="${esc(p.date)}"></label>
<div class="row"><button class="b" data-a="pdf">Download PDF</button><button class="b d" data-a="delP">Delete ${mm ? "machine" : "product"}</button></div>`;
  }
  $("#app").innerHTML = h;
  if (!keep) window.scrollTo(0, 0);
}

const comp = (f) =>
  new Promise((r) => {
    const u = URL.createObjectURL(f),
      i = new Image();
    i.onload = () => {
      const k = Math.min(1, 900 / Math.max(i.width, i.height)),
        c = document.createElement("canvas");
      c.width = i.width * k;
      c.height = i.height * k;
      c.getContext("2d").drawImage(i, 0, 0, c.width, c.height);
      URL.revokeObjectURL(u);
      r(c.toDataURL("image/jpeg", 0.7));
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
  } else if (a == "addR") {
    const q = P();
    q.res = q.res || [];
    q.res.push({ r: "", n: "1", m: "" });
  } else if (a == "rmR") {
    P().res.splice(i, 1);
  } else if (a == "tab") {
    T = t.dataset.t;
    MID = null;
  } else if (a == "mhome") {
    MID = null;
  } else if (a == "openM") {
    MID = t.dataset.id;
  } else if (a == "addM") {
    if (!nw || !nw.trim()) return;
    const m = {
      id: id(),
      name: nw.trim(),
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
    dl("setup-procedures-backup.json", JSON.stringify(S));
    return;
  } else if (a == "clearAll") {
    if (
      !confirm(
        "Delete ALL lines, products, steps and photos saved in this browser? This cannot be undone.",
      )
    )
      return;
    S = { lines: [], machines: [] };
    MID = null;
    try {
      localStorage.removeItem("sp");
    } catch (e) {}
    V = { l: null, p: null };
  } else if (a == "pdf") {
    return mkPdf();
  }
  save();
  R(/^(rmPh|addS|rmS|rmSI|up|dn|addR|rmR)$/.test(a));
});

document.addEventListener("input", (e) => {
  const t = e.target,
    p = P();
  if (!p) return;
  if (t.dataset.f) p[t.dataset.f] = t.value;
  else if (t.dataset.s !== undefined) p.steps[+t.dataset.s].t = t.value;
  else if (t.dataset.h !== undefined) p.steps[+t.dataset.h].h = t.value;
  else if (t.dataset.r !== undefined) {
    p.res[+t.dataset.r][t.dataset.rk] = t.value;
    $("#tot").textContent = tot(p);
  } else return;
  save();
});

document.addEventListener("change", async (e) => {
  const t = e.target;
  if (t.dataset.imp) {
    const f = t.files[0];
    if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      const b = parseBackup(j);
      if (!b) throw 0;
      if (!confirm("Replace all current data with this backup?")) return;
      S = b;
      save();
      V = { l: null, p: null };
      R();
    } catch (x) {
      alert("That file is not a valid backup.");
    }
    return;
  }
  if (!t.dataset.up) return;
  const p = P(),
    k = t.dataset.up;
  for (const f of t.files) {
    const d = await comp(f);
    if (k == "step") p.steps[+t.dataset.i].img = d;
    else p[k].push(d);
  }
  save();
  R(true);
});

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
  d.text("Setup procedure", M, y + 3);
  y += 8;
  para(p.name || "Untitled", M, CW, 20, 1);
  y += 4;
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
  p.steps.forEach((s, i) => {
    need(16);
    const y0 = y;
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
    if (y < y0 + 7) y = y0 + 7;
    y += 6;
  });
  need(58);
  sec("Staffing and time (completed by approver)");
  const cw3 = [CW - 76, 38, 38],
    hh = 8,
    rh = 9;
  let x = M;
  d.setDrawColor(...K);
  d.setLineWidth(0.3);
  ["Role / task", "People required", "Minutes required"].forEach((t, i) => {
    d.rect(x, y, cw3[i], hh);
    d.setFont("helvetica", "bold");
    d.setFontSize(9);
    tc(K);
    d.text(t, x + 2, y + 5.4);
    x += cw3[i];
  });
  y += hh;
  for (let r = 0; r < 4; r++) {
    x = M;
    cw3.forEach((w) => {
      d.rect(x, y, w, rh);
      x += w;
    });
    y += rh;
  }
  y += 4;
  need(44);
  y += 4;
  sec("Approval");
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
  y += 32;
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
R();
