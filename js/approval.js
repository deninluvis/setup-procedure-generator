// Approvals: Draft → (request by email) → Approved or Rejected.
// 1. The author presses Request approval: a .zip of the procedure is saved and
//    an email to the approver is opened (the author attaches the file).
// 2. The approver opens it on the Approvals page, checks it (review PDF),
//    approves or rejects with a comment and enters their approver code. A
//    signed approval .json is saved and a reply email opened.
// 3. The author imports the .json. It counts only if it was signed with a
//    listed approver's code (js/approvers.js) and the procedure is exactly as
//    it was approved; any later change makes it a draft again.
// p.ap = { st: "pending", to, req, fp }  or
//        { st: "approved" | "rejected", by, at, comment, fp, file, chg }
const AP_IMG = new Map(); // photo -> hash, so photos are hashed once
const AP_NOW = new Map(); // item id -> checked state (see apState)
let REQ = false, // request form open on the item page
  APR = null, // Approvals page: the request being reviewed
  APMSG = null, // { text, err } shown on the Approvals page and item page
  APMAIL = null; // last email opened, to open it again
const AP_KEY = "sp-ap"; // remembered names and email addresses (this browser)

const apPrefs = () => {
  try {
    return JSON.parse(localStorage.getItem(AP_KEY) || "{}") || {};
  } catch (e) {
    return {};
  }
};
const apSavePrefs = (v) => {
  try {
    localStorage.setItem(AP_KEY, JSON.stringify({ ...apPrefs(), ...v }));
  } catch (e) {}
};
const itemKind = (p) => (S.machines.includes(p) ? "machine" : "product");
const itemDept = (p) => deptName(deptOf(p, S.co), S.co);
const allItems = () => [
  ...S.lines.flatMap((l) => l.products.map((p) => ({ p, kind: "product", l }))),
  ...S.machines.map((m) => ({ p: m, kind: "machine" })),
];
const apDay = (iso) => logTime(iso).slice(0, 10);

// Opens the person's email program with a message ready to send. A link
// cannot attach files, so the page says which file to attach.
function openMail(to, subject, body) {
  APMAIL = { to, subject, body };
  const a = document.createElement("a");
  a.href =
    "mailto:" +
    encodeURIComponent(to || "") +
    "?subject=" +
    encodeURIComponent(subject) +
    "&body=" +
    encodeURIComponent(body);
  a.click();
}

// Checked approval state of an item:
// { st: "draft" | "pending" | "approved" | "changed" | "rejected" | "nocrypto", ... }
async function apState(p, kind) {
  if (!subtle()) return { st: "nocrypto" };
  let fp;
  try {
    if (AP_IMG.size > 500) AP_IMG.clear();
    fp = await apFingerprint(p, kind, itemDept(p), AP_IMG);
  } catch (e) {
    return { st: "nocrypto" };
  }
  const a = p.ap;
  let r = { st: "draft", fp };
  if (a && a.st == "approved") {
    const chk = await apCheck(a.file, APPROVERS);
    if (chk.ok && chk.payload.decision == "approved")
      r = {
        st: chk.payload.fp == fp ? "approved" : "changed",
        fp,
        name: chk.name,
        slot: chk.slot,
        aref: codeRef(a.file.pub), // approver reference (hidden in the PDF)
        at: chk.payload.at,
        comment: chk.payload.comment || "",
      };
  } else if (a && a.st == "pending")
    r = { st: "pending", fp, to: a.to, at: a.req, changed: a.fp != fp };
  else if (a && a.st == "rejected")
    r = {
      st: "rejected",
      fp,
      name: a.by,
      slot: a.slot,
      at: a.at,
      comment: a.comment || "",
    };
  AP_NOW.set(p.id, r);
  return r;
}

// Small status label for lists.
function apBadge(p) {
  const st = p.ap
    ? p.ap.st == "approved" && p.ap.chg
      ? "draft"
      : p.ap.st
    : "draft";
  const [cls, txt] =
    st == "approved"
      ? ["ok", "Approved"]
      : st == "pending"
        ? ["wait", "Waiting for approval"]
        : st == "rejected"
          ? ["no", "Rejected"]
          : ["dr", "Draft"];
  return `<span class="badge ${cls}">${txt}</span>`;
}

// " (Approver 1)" after a typed name, so it is clear which code signed it.
const apSlot = (r) =>
  r.slot && r.slot != r.name ? ` <span class="m">(${esc(r.slot)})</span>` : "";
const apMsgHtml = () =>
  APMSG
    ? `<p class="${APMSG.err ? "err" : "ok"}" role="status">${esc(APMSG.text)}</p>`
    : "";
const apImportBtn = (label) =>
  `<label class="b2">${label}<input type="file" accept=".json,application/json" hidden data-apfile="1"></label>`;

// Status box at the top of the product/machine page.
function apBoxInner(p) {
  const r = AP_NOW.get(p.id) || { st: "checking" },
    reqBtn = (t) => `<button class="b" data-a="apReq">${t}</button>`;
  let h = "";
  if (r.st == "checking") h = `<p class="m">Checking approval…</p>`;
  else if (r.st == "nocrypto")
    h = `<p><span class="badge dr">Draft</span></p><p class="m">This browser cannot check approvals, so PDFs print as drafts. Use a recent Chrome, Edge, Firefox or Safari.</p>`;
  else if (r.st == "approved")
    h =
      `<p><span class="badge ok">Approved</span> by <b>${esc(r.name)}</b>${apSlot(r)} on ${apDay(r.at)}. Digital signature checked.</p>` +
      (r.comment ? `<p class="apc">“${esc(r.comment)}”</p>` : "") +
      `<p class="m">Any change to this ${itemKind(p)} makes it a draft again.</p>`;
  else if (r.st == "changed")
    h = `<p><span class="badge dr">Draft</span> Changed after it was approved by <b>${esc(r.name)}</b>${apSlot(r)} on ${apDay(r.at)}.</p><p class="m">PDFs print with a DRAFT watermark. Undo the change, or request approval again.</p><div class="row" style="flex-wrap:wrap">${reqBtn("Request approval again")}${apImportBtn("Import approval file")}</div>`;
  else if (r.st == "pending")
    h =
      `<p><span class="badge wait">Waiting for approval</span> Sent to <b>${esc(r.to)}</b> on ${apDay(r.at)}.</p>` +
      (r.changed
        ? `<p class="err">You changed it after asking for approval, so the approval will not match. Request approval again.</p>`
        : `<p class="m">When the approval file arrives by email, import it here. Until then PDFs print with a DRAFT watermark.</p>`) +
      `<div class="row" style="flex-wrap:wrap">${apImportBtn("Import approval file")}<button class="b2" data-a="apReq">Request again</button>${APMAIL ? `<button class="b2" data-a="apMail">Open the email again</button>` : ""}</div>`;
  else if (r.st == "rejected")
    h =
      `<p><span class="badge no">Rejected</span> by <b>${esc(r.name)}</b>${apSlot(r)} on ${apDay(r.at)}.</p>` +
      (r.comment ? `<p class="apc">“${esc(r.comment)}”</p>` : "") +
      `<p class="m">Make the changes, then request approval again. PDFs print with a DRAFT watermark.</p><div class="row" style="flex-wrap:wrap">${reqBtn("Request approval again")}${apImportBtn("Import approval file")}</div>`;
  else
    h = `<p><span class="badge dr">Draft</span> Not approved yet. PDFs print with a DRAFT watermark.</p><div class="row" style="flex-wrap:wrap">${reqBtn("Request approval")}${apImportBtn("Import approval file")}</div>`;
  return apMsgHtml() + h + (REQ ? apReqForm(p) : "");
}
const apBox = (p) =>
  `<section class="apbox" id="apbox" aria-live="polite">${apBoxInner(p)}</section>`;

// The "Request approval" form.
function apReqForm(p) {
  const pr = apPrefs(),
    me = pr.me || {},
    last = APPROVERS.some((a) => a[0] == pr.last) ? pr.last : "";
  if (!APPROVERS.length)
    return `<p class="err">There are no approvers yet. Ask whoever manages the app to add them.</p>`;
  return `<div class="apform"><h3>Request approval</h3>
<label class="f">Approver<select data-ap="to">${(last ? "" : `<option value="">Choose…</option>`) + APPROVERS.map((a) => `<option${a[0] == last ? " selected" : ""}>${esc(a[0])}</option>`).join("")}</select></label>
<label class="f">Approver's email<input type="email" data-ap="tomail" value="${esc((pr.mail || {})[last] || "")}" placeholder="name@company.com"></label>
<div class="two"><label class="f">Your name<input data-ap="me" value="${esc((SESSION && SESSION.who) || me.name || p.by || "")}"></label><label class="f">Your email<input type="email" data-ap="mymail" value="${esc(me.email || "")}" placeholder="For the approver's reply"></label></div>
<p class="m">Pressing the button saves <b>Approval request - ${esc(p.name || "Untitled")} - rev ${esc(p.rev || "1")}.zip</b> and opens an email to the approver. <b>Attach that file</b> (from your Downloads folder) and send it.</p>
<div class="row" style="flex-wrap:wrap"><button class="b" data-a="apSend">Save request and open email</button><button class="b2" data-a="apReqCancel">Cancel</button></div></div>`;
}

const reqFileName = (p) =>
  `Approval request - ${safeName(p.name, "Procedure")} - rev ${safeName(p.rev || "1", "1")}.zip`;

async function requestApproval(btn) {
  const p = P(),
    kind = itemKind(p),
    val = (k) => ($(`[data-ap="${k}"]`) || {}).value || "",
    to = val("to"),
    tomail = val("tomail").trim(),
    me = val("me").trim(),
    mymail = val("mymail").trim();
  if (!to) return alert("Choose the approver.");
  if (!me) return alert("Enter your name.");
  const r = await apState(p, kind);
  if (r.st == "nocrypto")
    return alert(
      "This browser cannot handle approvals. Use a recent Chrome, Edge, Firefox or Safari.",
    );
  const at = new Date().toISOString(),
    plan = planItems(
      [
        {
          p,
          kind,
          line: kind == "product" ? L().name : "",
          dept: itemDept(p),
        },
      ],
      S,
    ),
    file = reqFileName(p);
  plan.data.request = {
    from: me,
    email: mymail,
    to,
    toEmail: tomail,
    at,
    fp: r.fp,
  };
  await exportZip(plan, file, btn, () => {
    const pr = apPrefs();
    apSavePrefs({
      me: { name: me, email: mymail },
      last: to,
      mail: { ...(pr.mail || {}), [to]: tomail },
    });
    p.ap = { st: "pending", to, req: at, fp: r.fp };
    flushItem(true);
    logAct(
      "approval",
      `Approval requested for ${itemLabel(p, kind, kind == "product" ? L() : null)}, rev ${p.rev || "-"}, from ${to}${tomail ? ` (${tomail})` : ""}`,
    );
    REQ = false;
    APMSG = {
      text: `Request saved as "${file}". Attach it to the email and send it to ${to}.`,
    };
    save();
    AP_NOW.delete(p.id);
    R(true);
    openMail(
      tomail,
      `Approval request: ${p.name || "Untitled"} rev ${p.rev || "1"}`,
      `Hello ${to},\n\nPlease review and approve the setup procedure "${p.name || "Untitled"}"` +
        `${p.code ? ` (${p.code})` : ""}, revision ${p.rev || "1"}.\n\n` +
        `1. Open the Setup Procedures app and log in with your approver code: the Approvals page opens.\n` +
        `2. Under "Review a request", choose the attached file "${file}".\n` +
        `3. Check it (Download PDF to review), approve or reject it, and enter your approver code.\n` +
        `4. Send the approval file back to me by email.\n\nThank you,\n${me}`,
    );
  });
}

// ---------- Approvals page ----------

// Approvers (logged in with an approver code) only see "Review a request";
// authors and admins only see "Import an approval".
function ApV() {
  const rev = isApprover();
  let h =
    (rev ? "" : `<button class="lk" data-a="goHome">← Home</button>`) +
    `<h1>Approvals</h1>${apMsgHtml()}`;
  if (rev)
    h += `
<h2>Review a request</h2><p class="m">Choose the approval request file (.zip) you received by email. It is only opened for checking: nothing is saved on this computer.</p>
<label class="b2">Choose request file<input type="file" accept=".zip,application/zip" hidden data-apreq="1"></label>`;
  if (rev && APR) {
    const { pack, req } = APR,
      p = pack.item,
      nPh = apImages(p).length,
      nNotes = (p.steps || []).reduce(
        (a, s) =>
          a +
          (s.warn !== undefined) +
          (s.subs || []).filter((u) => u.warn !== undefined).length,
        0,
      );
    h += `<div class="apform"><h3>${esc(p.name || "Untitled")}</h3>
<p>${pack.kind == "machine" ? "Machine" : "Product · " + esc(pack.line)}${p.code ? " · " + esc(p.code) : ""} · Revision ${esc(p.rev || "-")}${pack.dept ? " · " + esc(pack.dept) : ""}</p>
<p class="m">Requested by <b>${esc(req.from || "?")}</b>${req.email ? ` (${esc(req.email)})` : ""} on ${apDay(req.at)}, for ${esc(req.to || "?")}. ${count((p.steps || []).length, "step", "steps")}, ${count(nPh, "photo", "photos")}, ${count(nNotes, "warning or note", "warnings or notes")}.</p>`;
    if (APR.done)
      h += `<p class="ok">Saved "<b>${esc(APR.done)}</b>". Attach it to the email and send it to ${esc(req.from || "the author")}.</p><button class="b2" data-a="apMail">Open the email again</button>`;
    else
      h += `<div class="row"><button class="b2" data-a="apPdf">Download PDF to review</button></div>
<div class="radios"><label><input type="radio" name="apdec" value="approved"${APR.decision == "approved" ? " checked" : ""}> Approve</label><label><input type="radio" name="apdec" value="rejected"${APR.decision == "rejected" ? " checked" : ""}> Reject (say what must change)</label></div>
<label class="f">Comment${APR.decision == "rejected" ? "" : " (optional)"}<textarea data-apc="1" rows="3">${esc(APR.comment || "")}</textarea></label>
<label class="f">Your name (printed on the PDF as "Approved by")<input data-apn="1" maxlength="60" value="${esc(APR.name || "")}" autocomplete="name"></label>
${
  APCODE
    ? `<p class="m">Your decision is signed with the approver code you logged in with. Never send that code by email.</p>`
    : `<label class="f">Your approver code (to sign)<input type="password" id="apcode" autocomplete="off" spellcheck="false"></label>
<p class="m">Your approver code signs the decision. Never send it by email.</p>`
}
<button class="b" data-a="apSign">Sign and save decision</button>`;
    h += `</div>`;
  }
  if (!rev)
    h += `<h2>Import an approval</h2><p class="m">When an approver emails you an approval file (.json), import it here or on the product or machine page. It is checked and applied to the matching procedure.</p>${apImportBtn("Import approval file")}`;
  return h;
}

async function loadRequest(f) {
  APMSG = null;
  APR = null;
  const { data } = await readFile(f),
    c = fileContents(data),
    pack = c && c.packs.length == 1 ? c.packs[0] : null;
  if (!pack || !data.request) {
    APMSG = {
      text: "This is not an approval request file. Choose the .zip file from the request email.",
      err: true,
    };
  } else
    APR = {
      file: f.name,
      pack,
      req: data.request,
      company: c.company,
      decision: "approved",
      comment: "",
      name: (SESSION && SESSION.who) || apPrefs().signer || "",
    };
  R();
}

// Review PDF of the request, made without adding it to this browser's data.
function reviewPdf() {
  const { pack, company } = APR;
  return mkPdf({
    p: pack.item,
    mm: pack.kind == "machine",
    line: pack.line,
    coName: (company && company.name) || "",
    dept: pack.dept,
    logo: company && company.logo,
    review: true,
  });
}

async function signApproval(btn) {
  const code = APCODE || ($("#apcode") || {}).value || "",
    comment = String(APR.comment || "").trim(),
    signer = String(APR.name || "")
      .trim()
      .slice(0, 60),
    dec = APR.decision,
    show = (text) => {
      APMSG = { text, err: true };
      R(true);
    };
  if (!subtle())
    return show(
      "This browser cannot sign approvals. Use a recent Chrome, Edge, Firefox or Safari.",
    );
  if (dec == "rejected" && !comment)
    return show("Say what must change in the comment before rejecting.");
  if (!signer) return show("Enter your name.");
  if (!code.trim()) return show("Enter your approver code.");
  btn.disabled = true;
  try {
    const { priv, pub } = await apKeys(code),
      a = APPROVERS.find((x) => x[1] == pub);
    if (!a || (SESSION && SESSION.id && pub != SESSION.id))
      return show("That is not the approver code you logged in with.");
    const { pack, req } = APR,
      p = pack.item,
      payload = {
        decision: dec,
        comment,
        approver: a[0],
        signer,
        at: new Date().toISOString(),
        fp: await apFingerprint(p, pack.kind, pack.dept),
        item: {
          kind: pack.kind,
          name: p.name || "",
          code: p.code || "",
          rev: p.rev || "",
        },
        request: { from: req.from || "", at: req.at || "" },
      },
      file = {
        format: "setup-procedures-approval",
        version: 1,
        payload,
        pub,
        sig: await apSign(priv, payload),
      },
      name = `Approval - ${safeName(p.name, "Procedure")} - rev ${safeName(p.rev || "1", "1")} - ${dec}.json`,
      word = dec == "approved" ? "Approved" : "Not approved";
    await dl(
      name,
      new Blob([JSON.stringify(file, null, 1)], { type: "application/json" }),
    );
    APR.done = name;
    logAct(
      "approval",
      `${dec == "approved" ? "Approved" : "Rejected"} ${pack.kind} "${p.name || "Untitled"}" rev ${p.rev || "-"} as ${signer} (requested by ${req.from || "?"})${comment ? `: "${comment}"` : ""}`,
    );
    APMSG = null;
    R(true);
    openMail(
      req.email || "",
      `${word}: ${p.name || "Untitled"} rev ${p.rev || "1"}`,
      `Hello ${req.from || ""},\n\n` +
        (dec == "approved"
          ? `I have approved "${p.name}" revision ${p.rev || "1"}.`
          : `I have not approved "${p.name}" revision ${p.rev || "1"}.`) +
        (comment ? `\n\nComment: ${comment}` : "") +
        `\n\nImport the attached file "${name}" in the Setup Procedures app: Home → Approvals → Import approval file (or on the ${pack.kind}'s page).\n\n${signer}`,
    );
  } finally {
    btn.disabled = false;
  }
}

// Import a signed approval (.json) and apply it to the matching procedure.
async function importApproval(f) {
  const fail = (text) => {
    APMSG = { text, err: true };
    logAct("approval", `Approval file "${f.name}" refused: ${text}`);
    R(true);
  };
  if (!subtle())
    return fail(
      "This browser cannot check approvals. Use a recent Chrome, Edge, Firefox or Safari.",
    );
  let file;
  try {
    file = JSON.parse(await f.text());
  } catch (e) {
    return fail("This is not an approval file.");
  }
  const chk = await apCheck(file, APPROVERS);
  if (!chk.ok) return fail(chk.why);
  const pl = chk.payload,
    it = pl.item || {},
    what = `"${it.name || "?"}" rev ${it.rev || "-"}`;
  let hit = null;
  for (const x of allItems())
    if ((await apFingerprint(x.p, x.kind, itemDept(x.p), AP_IMG)) == pl.fp) {
      hit = x;
      break;
    }
  if (!hit) {
    const same = allItems().some(
      (x) =>
        String(x.p.name || "")
          .trim()
          .toLowerCase() ==
        String(it.name || "")
          .trim()
          .toLowerCase(),
    );
    return fail(
      same
        ? `This approval is for ${what} as it was when approval was requested, but it has been changed since. Request approval again.`
        : `No product or machine here matches this approval for ${what}.`,
    );
  }
  const p = hit.p,
    ok = pl.decision == "approved";
  remember(
    `${ok ? "Approval" : "Rejection"} imported for ${p.name || "Untitled"}`,
  );
  logAct(
    "approval",
    `${ok ? "Approval" : "Rejection"} by ${chk.name} (${chk.slot}) imported for ${itemLabel(p, hit.kind, hit.l)}, rev ${p.rev || "-"}${pl.comment ? `: "${pl.comment}"` : ""}`,
  );
  p.ap = {
    st: ok ? "approved" : "rejected",
    by: chk.name,
    slot: chk.slot,
    at: pl.at,
    comment: pl.comment || "",
    fp: pl.fp,
    file,
  };
  if (ok) p.appr = chk.name;
  if (hit.kind == "machine") {
    T = "m";
    MID = p.id;
  } else {
    T = "p";
    V = { l: hit.l.id, p: p.id };
  }
  APMSG = {
    text: ok
      ? "Approval imported."
      : "Rejection imported. See the comment below.",
  };
  REQ = false;
  AP_NOW.delete(p.id);
  save();
  R();
}

// After the item page is drawn, and after typing, check the approval state
// again and update the status box if it changed.
let apTimer = null;
async function apRefresh() {
  const p = P();
  if (!p || !((T == "p" && V.p) || (T == "m" && MID))) return;
  const old = AP_NOW.get(p.id),
    r = await apState(p, itemKind(p));
  if (P() !== p) return;
  const key = (x) => x && [x.st, x.name, x.at, x.changed].join("|");
  if (key(old) != key(r)) {
    const el = $("#apbox");
    if (el) el.innerHTML = apBoxInner(p);
  }
  // Remember "changed after approval" for the list badges.
  if (p.ap && p.ap.st == "approved" && !!p.ap.chg != (r.st == "changed")) {
    if (r.st == "changed") p.ap.chg = true;
    else delete p.ap.chg;
    save();
  }
}
document.addEventListener("input", (e) => {
  if (e.target.dataset.apc !== undefined && APR) APR.comment = e.target.value;
  if (e.target.dataset.apn !== undefined && APR) {
    APR.name = e.target.value;
    apSavePrefs({ signer: e.target.value });
  }
  if ((T == "p" && V.p) || (T == "m" && MID)) {
    clearTimeout(apTimer);
    apTimer = setTimeout(apRefresh, 500);
  }
});
document.addEventListener("change", async (e) => {
  const t = e.target;
  if (t.dataset.apreq && t.files[0]) {
    const f = t.files[0];
    t.value = "";
    await loadRequest(f);
  } else if (t.dataset.apfile && t.files[0]) {
    const f = t.files[0];
    t.value = "";
    await importApproval(f);
  } else if (t.name == "apdec" && APR) {
    APR.decision = t.value;
    APMSG = null;
    R(true);
    $(`input[name="apdec"][value="${t.value}"]`).focus();
  } else if (t.dataset.ap == "to") {
    const m = (apPrefs().mail || {})[t.value];
    const el = $('[data-ap="tomail"]');
    if (el && m) el.value = m;
  }
});
