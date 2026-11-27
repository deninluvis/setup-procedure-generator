// The line with this name, matched the way imports match it.
const lineNamed = (n) => S.lines.find((l) => nameKey(l.name) == nameKey(n));
// An empty name box: say so next to it (cleared when typing).
function needName(msg) {
  const el = $("#nw");
  el.setCustomValidity(msg);
  el.reportValidity();
  el.addEventListener("input", () => el.setCustomValidity(""), { once: true });
}
// User actions: clicks (data-a), typing (input), file/select/tick-box
// changes, and Enter shortcuts. Each change is saved, then R() redraws.
document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-a]");
  // A click outside the ⋮ menu closes it (clicks on its options inside do not).
  if (MENU && !e.target.closest(".kebab")) {
    MENU = "";
    PICK = "";
    R(true);
    if (!t) return;
  }
  if (!t) return;
  if (t.dataset.a == "menu") {
    const m = t.dataset.m;
    MENU = MENU == m ? "" : m;
    PICK = "";
    R(true);
    const first = $(
      MENU
        ? ".kmenu button, .kmenu input, .kmenu label"
        : `[data-a=menu][data-m="${m}"]`,
    );
    if (first) first.focus({ preventScroll: true });
    return;
  }
  if (t.closest(".kmenu")) MENU = ""; // an option was chosen
  if (VIEW && !/^(view|phMv)$/.test(t.dataset.a)) VIEW = null; // viewer closes
  if (t.dataset.a != "pickLine") PICK = "";
  if (!/^(addOpen|addL|addP|addM)$/.test(t.dataset.a)) ADDING = "";
  const a = t.dataset.a,
    i = +t.dataset.i,
    j = +t.dataset.j,
    nw = ($("#nw") || {}).value;
  let focus = null; // element to focus after re-rendering
  if (!/^ap/.test(a)) {
    APMSG = null; // approval messages and the request form close on other actions
    REQ = false;
  }
  if (a == "home") {
    V = { l: null, p: null };
  } else if (a == "openL") {
    V = { l: t.dataset.id, p: null };
  } else if (a == "openP") {
    V.p = t.dataset.id;
  } else if (a == "addL") {
    if (!nw || !nw.trim()) return needName("Enter a line name.");
    const same = lineNamed(nw);
    if (same) {
      alert(`There is already a line called "${same.name}". It opens now.`);
      V = { l: same.id, p: null };
      return R();
    }
    const l = { id: id(), name: nw.trim(), products: [] };
    S.lines.push(l);
    logAct("change", `Line "${l.name}" created`);
    V = { l: l.id, p: null };
  } else if (a == "renL") {
    const l = L(),
      v = prompt("New name for this line:", l.name);
    if (v == null || !v.trim() || v.trim() == l.name) return;
    const same = lineNamed(v);
    if (same && same.id != l.id)
      return alert(`There is already a line called "${same.name}".`);
    remember(`Line "${l.name}" renamed`);
    logAct("change", `Line "${l.name}" renamed to "${v.trim()}"`);
    l.name = v.trim();
  } else if (a == "addP") {
    if (!nw || !nw.trim()) return needName("Enter a product name.");
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
      by: (SESSION && SESSION.who) || "",
      appr: "",
    };
    L().products.push(p);
    logAct("change", `Created ${itemLabel(p, "product", L())}`);
    V.p = p.id;
  } else if (a == "delL") {
    if (!confirm("Delete this line and all its products?")) return;
    remember(`Line "${L().name}" deleted`);
    logAct(
      "delete",
      `Line "${L().name}" deleted, with ${count(L().products.length, "product", "products")}${
        L().products.length
          ? ": " +
            L()
              .products.map((p) => p.name)
              .join(", ")
          : ""
      }`,
    );
    S.lines = S.lines.filter((x) => x.id != V.l);
    V = { l: null, p: null };
  } else if (a == "delP") {
    if (!confirm("Delete this " + (T == "m" ? "machine" : "product") + "?"))
      return;
    remember(`${T == "m" ? "Machine" : "Product"} "${P().name}" deleted`);
    flushItem(); // record edits made before deleting
    logAct(
      "delete",
      `Deleted ${itemLabel(P(), T == "m" ? "machine" : "product", T == "m" ? null : L())}, rev ${P().rev || "-"}`,
    );
    if (T == "m") {
      S.machines = S.machines.filter((x) => x.id != MID);
      MID = null;
    } else {
      const l = L();
      l.products = l.products.filter((x) => x.id != V.p);
      V.p = null;
    }
  } else if (a == "pickLine") {
    MENU = "t"; // stay open, now listing the lines
    PICK = t.dataset.k;
    R(true);
    const b = $(".kmenu button");
    if (b) b.focus();
    return;
  } else if (a == "pickBack") {
    MENU = "t";
    R(true);
    return;
  } else if (a == "dupP") {
    // A copy as a new draft (no approval), next to the original, or at the
    // end of another line (data-l). Name: the same if free there, otherwise
    // the first free "X (copy)", "X (copy 2)" …
    flushItem(true);
    const p = P(),
      mm = T == "m",
      to = !mm && t.dataset.l ? S.lines.find((x) => x.id == t.dataset.l) : null,
      list = mm ? S.machines : (to || L()).products,
      taken = (n) => list.some((x) => nameKey(x.name) == nameKey(n));
    let name = to && !taken(p.name) ? p.name : `${p.name} (copy)`;
    for (let n = 2; taken(name); n++) name = `${p.name} (copy ${n})`;
    const c = { ...copyData(p), id: id(), name };
    delete c.ap;
    c.appr = "";
    if (to) list.push(c);
    else list.splice(list.indexOf(p) + 1, 0, c);
    logAct(
      "change",
      `Duplicated ${itemLabel(p, mm ? "machine" : "product", mm ? null : L())} as "${name}"${to ? ` in line "${to.name}"` : ""}`,
    );
    if (mm) MID = c.id;
    else V = { l: (to || L()).id, p: c.id };
    toast(`Duplicated: you are now editing "${name}"`, false);
    window.scrollTo(0, 0);
  } else if (a == "mergeL") {
    // Move every product of this line into another line, then remove it.
    const src = L(),
      dst = S.lines.find((x) => x.id == t.dataset.l);
    if (!dst) return;
    if (
      !confirm(
        `Move all ${count(src.products.length, "product", "products")} from "${src.name}" into "${dst.name}" and remove the line "${src.name}"?`,
      )
    )
      return R(true);
    remember(`Line "${src.name}" merged into "${dst.name}"`);
    const taken = (n) =>
      dst.products.some((x) => nameKey(x.name) == nameKey(n));
    for (const p of src.products) {
      if (taken(p.name)) {
        const base = `${p.name} (${src.name})`;
        let n = 2;
        p.name = base;
        while (taken(p.name)) p.name = `${base} ${n++}`;
      }
      dst.products.push(p);
    }
    S.lines = S.lines.filter((x) => x.id != src.id);
    logAct("change", `Line "${src.name}" merged into "${dst.name}"`);
    V = { l: dst.id, p: null };
  } else if (a == "phMv") {
    // Move a step photo left or right (the viewer follows it).
    const st = P().steps[i],
      o = t.dataset.k == "sub" ? st.subs[j] : st,
      arr = photosOf(o),
      n = +t.dataset.n,
      m = n + +t.dataset.d;
    if (m < 0 || m >= arr.length) return;
    [arr[n], arr[m]] = [arr[m], arr[n]];
    setPhotos(o, arr);
    VIEW.n = m;
  } else if (a == "rmPh") {
    remember("Photo removed");
    P()[t.dataset.k].splice(i, 1);
  } else if (a == "addSet") {
    const p = P();
    p.set = p.set || [];
    p.set.push({ n: "", v: "", u: "" });
    focus = `[data-set="${p.set.length - 1}"][data-sk="n"]`;
  } else if (a == "rmSet") {
    const x = P().set[i];
    remember(`Setting${x.n.trim() ? ` "${x.n.trim()}"` : ""} removed`);
    P().set.splice(i, 1);
  } else if (a == "pdfLine" || a == "pdfMach") {
    const list =
      a == "pdfMach"
        ? S.machines.map((p) => ({ p, mm: true, line: "" }))
        : L().products.map((p) => ({ p, mm: false, line: L().name }));
    if (!list.length) {
      R(true);
      return alert("There is nothing to print yet.");
    }
    pdfZip(
      list,
      `${safeName(a == "pdfMach" ? "Machines" : L().name, "PDFs")} - PDFs - ${dateStamp()}.zip`,
      t,
    ).finally(() => R(true));
    return;
  } else if (a == "addTool") {
    const p = P();
    p.tools = p.tools || [];
    p.tools.push({ n: "", s: "" });
    focus = `[data-tool="${p.tools.length - 1}"][data-tk="n"]`;
  } else if (a == "rmTool") {
    const tl = P().tools[i];
    remember(`Tool${tl.n.trim() ? ` "${tl.n.trim()}"` : ""} removed`);
    P().tools.splice(i, 1);
  } else if (a == "addS") {
    P().steps.push({ t: "", img: "" });
    focus = `[data-h="${P().steps.length - 1}"]`;
  } else if (a == "insS") {
    P().steps.splice(i + 1, 0, { t: "", img: "" });
    focus = `[data-h="${i + 1}"]`;
  } else if (a == "rmS") {
    const n = (P().steps[i].subs || []).length;
    remember(
      `Step ${i + 1}${n ? ` and its ${count(n, "sub-step", "sub-steps")}` : ""} deleted`,
    );
    P().steps.splice(i, 1);
  } else if (a == "addW") {
    stepOrSub(i, j).warn = "";
    focus = isNaN(j)
      ? `[data-w="${i}"]:not([data-wj])`
      : `[data-w="${i}"][data-wj="${j}"]`;
  } else if (a == "rmW") {
    const o = stepOrSub(i, j),
      where = isNaN(j) ? `step ${i + 1}` : `sub-step ${i + 1}.${j + 1}`;
    remember(`${NOTE_TYPES[noteType(o)].label} removed from ${where}`);
    delete o.warn;
    delete o.wtype;
    focus =
      `[data-a=addW][data-i="${i}"]` +
      (isNaN(j) ? ":not([data-j])" : `[data-j="${j}"]`);
  } else if (a == "addSub") {
    const s = P().steps[i];
    s.subs = s.subs || [];
    s.subs.push({ t: "", img: "" });
    focus = `[data-ss="${i}"][data-sj="${s.subs.length - 1}"]`;
  } else if (a == "rmSub") {
    remember(`Sub-step ${i + 1}.${j + 1} deleted`);
    P().steps[i].subs.splice(j, 1);
  } else if (a == "rmSubI") {
    remember(`Photo removed from sub-step ${i + 1}.${j + 1}`);
    const u = P().steps[i].subs[j];
    setPhotos(
      u,
      photosOf(u).filter((x, n) => n != (+t.dataset.n || 0)),
    );
  } else if (a == "subUp" && j > 0) {
    const u = P().steps[i].subs;
    [u[j - 1], u[j]] = [u[j], u[j - 1]];
    focus = `[data-a=subUp][data-i="${i}"][data-j="${j - 1}"]`;
  } else if (a == "subDn" && j < P().steps[i].subs.length - 1) {
    const u = P().steps[i].subs;
    [u[j + 1], u[j]] = [u[j], u[j + 1]];
    focus = `[data-a=subDn][data-i="${i}"][data-j="${j + 1}"]`;
  } else if (a == "rmSI") {
    remember(`Photo removed from step ${i + 1}`);
    const s = P().steps[i];
    setPhotos(
      s,
      photosOf(s).filter((x, n) => n != (+t.dataset.n || 0)),
    );
  } else if (a == "up" && i > 0) {
    const s = P().steps;
    [s[i - 1], s[i]] = [s[i], s[i - 1]];
  } else if (a == "dn" && i < P().steps.length - 1) {
    const s = P().steps;
    [s[i + 1], s[i]] = [s[i], s[i + 1]];
  } else if (a == "rmLogo") {
    remember("Logo removed");
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
      used = [...S.machines, ...S.lines.flatMap((l) => l.products)].filter(
        (p) => deptOf(p, S.co) == d.id,
      ).length;
    remember(
      `Department "${d.name || "(empty)"}" removed` +
        (used
          ? `; ${count(used, "item has", "items have")} no department now`
          : ""),
    );
    logAct("delete", `Department "${d.name || "(empty)"}" removed`);
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
    T = S.co.done ? "set" : "h"; // edited from Settings: back there
    S.co.done = true;
    Store.persist();
  } else if (a == "mhome") {
    MID = null;
  } else if (a == "openM") {
    MID = t.dataset.id;
  } else if (a == "addM") {
    if (!nw || !nw.trim()) return needName("Enter a machine name.");
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
      by: (SESSION && SESSION.who) || "",
      appr: "",
    };
    S.machines.push(m);
    logAct("change", `Created ${itemLabel(m, "machine")}`);
    MID = m.id;
  } else if (a == "bk") {
    exportZip(
      planBackup(backupState()),
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
    ).then(() => R(true)); // closes the ⋮ menu once the file is saved
    return;
  } else if (a == "goAp") {
    T = "ap";
    APR = null;
  } else if (a == "apReq") {
    REQ = true;
    APMSG = null;
    R(true);
    const el = $('[data-ap="to"]');
    if (el) el.focus();
    return;
  } else if (a == "apReqCancel") {
    REQ = false;
    R(true);
    return;
  } else if (a == "apSend") {
    requestApproval(t);
    return;
  } else if (a == "apSign") {
    signApproval(t);
    return;
  } else if (a == "apPdf") {
    reviewPdf();
    return;
  } else if (a == "apMail") {
    if (APMAIL) openMail(APMAIL.to, APMAIL.subject, APMAIL.body);
    return;
  } else if (a == "sClear") {
    const k = t.dataset.k;
    if (k == "hs") HS = "";
    else if (k == "xf") XF = "";
    else if (k == "lf") LF = "";
    else AF = "";
    R(true);
    const f = $(`[data-${k}]`);
    if (f) f.focus();
    return;
  } else if (a == "mk") {
    if ($("#pv")) R(true); // close the photo viewer under the editor
    openMarkup(t.dataset.k, i, j, +t.dataset.n || 0);
    return;
  } else if (a == "view") {
    VIEW = { k: t.dataset.k, i, j, n: +t.dataset.n || 0 };
    R(true);
    $("#pv .b").focus();
    return;
  } else if (a == "vClose") {
    R(true);
    return;
  } else if (a == "addOpen") {
    ADDING = t.dataset.k;
    R(true);
    $("#nw").focus();
    return;
  } else if (a == "addCancel") {
    R(true);
    return;
  } else if (a == "apInfo") {
    AP_OPEN = !AP_OPEN;
    R(true);
    $("#apbadge").focus();
    return;
  } else if (a == "help") {
    HELPS.item = !HELPS.item;
    saveView();
    R(true);
    return;
  } else if (a == "goSet") {
    T = "set";
    MID = null;
    V = { l: null, p: null };
  } else if (a == "xtab") {
    XTAB = t.dataset.t;
    R(true);
    return;
  } else if (a == "logout") {
    if (!confirm("Log out? The next person logs in with their own code."))
      return;
    logout();
    return;
  } else if (a == "ltab") {
    LTAB = t.dataset.t;
    R(true);
    $(`[data-a=ltab][data-t="${LTAB}"]`).focus();
    return;
  } else if (a == "actCsv") {
    actCsv();
    return;
  } else if (a == "codesCsv") {
    codesCsv();
    return;
  } else if (a == "actClear") {
    if (!isAdmin()) return;
    if (
      !confirm(
        "Clear the whole activity log? This cannot be undone after you close the page.",
      )
    )
      return;
    remember("Activity log cleared");
    S.act = [];
    logAct("data", "Activity log cleared");
  } else if (a == "goLog") {
    if (!isAdmin()) return;
    T = "log";
    LTAB = "act";
    LF = "";
  } else if (a == "logCsv") {
    logCsv();
    return;
  } else if (a == "afClear") {
    AF = "";
    AT = "";
  } else if (a == "lfClear") {
    LF = "";
  } else if (a == "logClear") {
    if (
      !confirm(
        "Clear the whole print log? This cannot be undone after you close the page.",
      )
    )
      return;
    remember("Print log cleared");
    S.log = [];
    logAct("data", "Print log cleared");
  } else if (a == "goX") {
    T = "x";
    XTAB = "ex";
    EXS = new Set(allKeys("x"));
    IMP = null;
    XMSG = "";
    LASTMISS = [];
    XF = "";
  } else if (a == "tgl") {
    COL.has(t.dataset.g) ? COL.delete(t.dataset.g) : COL.add(t.dataset.g);
    saveView();
    R(true);
    $(`[data-a=tgl][data-g="${CSS.escape(t.dataset.g)}"]`).focus();
    return;
  } else if (a == "openHit") {
    const [kind, hid] = t.dataset.k.split(":");
    if (kind == "m") {
      T = "m";
      MID = hid;
    } else {
      const l = S.lines.find((x) => x.products.some((p) => p.id == hid));
      if (!l) return;
      T = "p";
      V = { l: l.id, p: hid };
    }
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
    ).then(() => R(true)); // closes the ⋮ menu once the file is saved
    return;
  } else if (a == "clearAll") {
    if (!isAdmin()) return;
    if (
      !confirm(
        "Delete ALL lines, products, steps and photos saved in this browser? You can undo this until you close or reload the page.",
      )
    )
      return;
    remember("All data cleared");
    flushItem();
    // The logs stay: they record what happened, including this.
    S = {
      lines: [],
      machines: [],
      co: { name: "", depts: [{ id: id(), name: "" }] },
      log: S.log,
      act: S.act,
    };
    logAct("data", "All data cleared");
    T = "co";
    MID = null;
    V = { l: null, p: null };
  } else if (a == "pdf") {
    flushItem(true); // record changes up to this PDF
    const issues = pdfChecks(P(), T == "m" ? "machine" : "product");
    if (
      issues.length &&
      String(P().by || "").trim() &&
      !confirm(
        `Before printing, please check:\n\n• ${issues.join("\n• ")}\n\nMake the PDF anyway?`,
      )
    )
      return R(true);
    const label = t.textContent;
    t.disabled = true;
    t.textContent = "Making PDF…";
    return mkPdf()
      .catch(() =>
        alert("Could not make the PDF. Reload the page and try again."),
      )
      .finally(() => {
        t.disabled = false;
        t.textContent = label;
        R(true); // closes the ⋮ menu
      });
  }
  save();
  R(
    /^(rmPh|phMv|addS|insS|rmS|rmSI|up|dn|addSub|rmSub|rmSubI|subUp|subDn|addW|rmW|addTool|rmTool)$/.test(
      a,
    ),
  );
  if (focus && $(focus)) $(focus).focus();
});

document.addEventListener("input", (e) => {
  const t = e.target;
  if (t.dataset.hs) {
    HS = t.value;
    $("#hres").innerHTML = homeResults();
    return;
  }
  if (t.dataset.lf) {
    LF = t.value;
    const pos = t.selectionStart;
    R(true);
    const f = $("[data-lf]");
    f.focus();
    f.setSelectionRange(pos, pos);
    return;
  }
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
  else if (t.dataset.w !== undefined)
    stepOrSub(+t.dataset.w, +t.dataset.wj).warn = t.value;
  else if (t.dataset.tool !== undefined)
    p.tools[+t.dataset.tool][t.dataset.tk] = t.value;
  else if (t.dataset.set !== undefined)
    p.set[+t.dataset.set][t.dataset.sk] = t.value;
  else if (t.dataset.ss !== undefined)
    p.steps[+t.dataset.ss].subs[+t.dataset.sj].t = t.value;
  else return;
  // Keep the "3 tools" / "2 settings" counts on the section titles current.
  const sum = (k, txt) => {
    const el = $(`[data-sec="${k}"] > summary .m`);
    if (el) el.textContent = txt;
  };
  if (t.dataset.tool !== undefined)
    sum(
      "tools",
      count(
        p.tools.filter((x) => String(x.n || "").trim()).length,
        "tool",
        "tools",
      ),
    );
  if (t.dataset.set !== undefined)
    sum("set", count(settingsOf(p).length, "setting", "settings"));
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
    if (prev) remember("Logo changed");
    S.logo = d;
    if (!(await writeNow())) {
      S.logo = prev;
      if (prev) UNDO.pop();
    }
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
  if (t.dataset.wm) {
    WM = t.checked;
    saveView();
    return;
  }
  if (t.dataset.ps) {
    PS = t.value;
    saveView();
    return;
  }
  // Safety equipment tick boxes: kept in the fixed PPE order.
  if (t.dataset.ppe) {
    const p = P(),
      on = new Set(p.ppe || []);
    t.checked ? on.add(t.dataset.ppe) : on.delete(t.dataset.ppe);
    p.ppe = PPE.map((x) => x.k).filter((k) => on.has(k));
    save();
    R(true);
    const el = $(`[data-ppe="${t.dataset.ppe}"]`);
    if (el) el.focus();
    return;
  }
  if (t.name == "grp") {
    GRP = t.value;
    saveView();
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
  if (t.dataset.wt !== undefined) {
    const i = +t.dataset.wt,
      j = +t.dataset.wj;
    stepOrSub(i, j).wtype = t.value;
    save();
    R(true);
    const el = $(
      `[data-wt="${i}"]` + (isNaN(j) ? ":not([data-wj])" : `[data-wj="${j}"]`),
    );
    if (el) el.focus();
    return;
  }
  if (!t.dataset.up) return;
  const p = P(),
    k = t.dataset.up,
    si = +t.dataset.i,
    sj = +t.dataset.j,
    o0 = k == "step" ? p.steps[si] : k == "sub" ? p.steps[si].subs[sj] : null;
  let files = [...t.files];
  t.value = "";
  // A step or sub-step holds at most MAX_STEP_PHOTOS photos.
  if (o0) {
    const room = Math.max(0, MAX_STEP_PHOTOS - photosOf(o0).length);
    if (files.length > room) {
      alert(
        `A step can have up to ${MAX_STEP_PHOTOS} photos. ${room ? `Only the first ${count(room, "photo", "photos")} you picked ${room == 1 ? "was" : "were"} added.` : "Remove one to add another."}`,
      );
      files = files.slice(0, room);
    }
  }
  // Add and save photos one at a time; if storage fills up, keep the ones
  // that fit and undo the one that did not.
  for (const f of files) {
    const d = await comp(f);
    if (!d) {
      alert(BAD_IMG);
      continue;
    }
    // Step and sub-step photos are added after the ones already there.
    const o =
        k == "step" ? p.steps[si] : k == "sub" ? p.steps[si].subs[sj] : null,
      before = o && photosOf(o);
    if (o) setPhotos(o, [...before, d]);
    else p[k].push(d);
    if (!(await writeNow())) {
      if (o) setPhotos(o, before);
      else p[k].pop();
      break;
    }
  }
  R(true);
});

// Escape closes the ⋮ menu.
document.addEventListener("keydown", (e) => {
  if (e.key == "Escape" && VIEW) {
    VIEW = null;
    R(true);
    return;
  }
  // Enter in a "New line / product / machine" box adds it.
  if (e.key == "Enter" && e.target.id == "nw") {
    e.preventDefault();
    e.target.parentElement.querySelector(".b").click();
    return;
  }
  if (e.key == "Escape" && MENU) {
    const m = MENU;
    MENU = "";
    PICK = "";
    R(true);
    const b = $(`[data-a=menu][data-m="${m}"]`);
    if (b) b.focus({ preventScroll: true });
  }
});

// Enter in a tool row moves to the next row; in the home search it opens
// the first match.
document.addEventListener("keydown", (e) => {
  if (
    e.key == "Enter" &&
    e.target.dataset &&
    e.target.dataset.tool !== undefined
  ) {
    e.preventDefault();
    const i = +e.target.dataset.tool,
      next = $(`[data-tool="${i + 1}"][data-tk="n"]`);
    if (next) next.focus();
    else $("[data-a=addTool]").click();
    return;
  }
  if (
    e.key == "Enter" &&
    e.target.dataset &&
    e.target.dataset.set !== undefined
  ) {
    e.preventDefault();
    const next = $(`[data-set="${+e.target.dataset.set + 1}"][data-sk="n"]`);
    if (next) next.focus();
    else $("[data-a=addSet]").click();
    return;
  }
  if (e.key == "Enter" && e.target.dataset && e.target.dataset.hs) {
    const first = $("#hres .hit");
    if (first) {
      e.preventDefault();
      first.click();
    }
  }
});

// Drag and drop to reorder steps (computers): drag a step by its ⠿ handle and
// drop it on another step; the top half puts it before, the bottom half after.
// Phones and keyboards use Move up / Move down in the step's ⋮.
let DRAG = null; // index of the step being dragged
const dropAt = (e) => {
  const box = e.target.closest && e.target.closest("[data-box]");
  if (!box) return null;
  const r = box.getBoundingClientRect();
  return { box, i: +box.dataset.box, after: e.clientY > r.top + r.height / 2 };
};
const clearDrop = () =>
  document
    .querySelectorAll(".drop-b, .drop-a, .dragging")
    .forEach((x) => x.classList.remove("drop-b", "drop-a", "dragging"));
document.addEventListener("dragstart", (e) => {
  const h = e.target.closest && e.target.closest("[data-drag]");
  if (!h) return;
  DRAG = +h.dataset.drag;
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", String(DRAG));
  const box = h.closest("[data-box]");
  e.dataTransfer.setDragImage(box, 20, 20);
  box.classList.add("dragging");
});
document.addEventListener("dragover", (e) => {
  if (DRAG === null) return;
  const d = dropAt(e);
  if (!d) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
  document
    .querySelectorAll(".drop-b, .drop-a")
    .forEach((x) => x.classList.remove("drop-b", "drop-a"));
  d.box.classList.add(d.after ? "drop-a" : "drop-b");
});
document.addEventListener("drop", (e) => {
  if (DRAG === null) return;
  const d = dropAt(e);
  e.preventDefault();
  const from = DRAG;
  DRAG = null;
  clearDrop();
  if (!d) return;
  let to = d.i + (d.after ? 1 : 0);
  if (from < to) to--; // the list is one shorter once the step is taken out
  if (to == from) return;
  const s = P().steps;
  s.splice(to, 0, s.splice(from, 1)[0]);
  save();
  R(true);
  toast(`Step ${from + 1} moved to position ${to + 1}`, false);
});
document.addEventListener("dragend", () => {
  DRAG = null;
  clearDrop();
});
