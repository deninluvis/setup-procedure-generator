// User actions: clicks (data-a), typing (input), file/select/tick-box
// changes, and Enter shortcuts. Each change is saved, then R() redraws.
document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-a]");
  if (!t) return;
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
    if (!nw || !nw.trim()) return;
    const l = { id: id(), name: nw.trim(), products: [] };
    S.lines.push(l);
    logAct("change", `Line "${l.name}" created`);
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
  } else if (a == "rmPh") {
    remember("Photo removed");
    P()[t.dataset.k].splice(i, 1);
  } else if (a == "addTool") {
    const p = P();
    p.tools = p.tools || [];
    p.tools.push({ n: "", s: "", q: "" });
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
    );
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
  } else if (a == "mk") {
    openMarkup(t.dataset.k, i, j, +t.dataset.n || 0);
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
    );
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
    return mkPdf();
  }
  save();
  R(
    /^(rmPh|addS|insS|rmS|rmSI|up|dn|addSub|rmSub|rmSubI|subUp|subDn|addW|rmW|addTool|rmTool)$/.test(
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
  else if (t.dataset.ss !== undefined)
    p.steps[+t.dataset.ss].subs[+t.dataset.sj].t = t.value;
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
  if (e.key == "Enter" && e.target.dataset && e.target.dataset.hs) {
    const first = $("#hres .hit");
    if (first) {
      e.preventDefault();
      first.click();
    }
  }
});
