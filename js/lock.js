// Log in and log out. Three kinds of code, each opening different pages:
//  - author (access codes, js/access.js): products, machines, PDFs and
//    approval requests
//  - admin (admin codes, js/admins.js): everything an author can do, plus the
//    print log and "Clear all saved data"
//  - approver (approver codes, js/approvers.js): only the Approvals page, to
//    review requests and sign decisions
// The login is remembered in this browser ("sp-access" = { r, id }) until
// Log out, so several people can take turns on one computer. If a code is
// removed from its list, its login stops working. Only stops casual visitors:
// the app's code is public (approvals themselves are signed, see utils.js).
const ACCESS_KEY = "sp-access";
let SESSION = null, // { r: "author" | "admin" | "approver", id, name }
  APCODE = "", // the approver code typed at login: memory only, for signing
  memSession = null; // used when this browser cannot remember anything

const roleLists = () => ({
  author: ACCESS_CODES,
  admin: ADMIN_CODES,
  approver: APPROVERS,
});
const ROLE_NAMES = { author: "Author", admin: "Admin", approver: "Approver" };
const noCodes = () =>
  !ACCESS_CODES.length && !ADMIN_CODES.length && !APPROVERS.length;

const savedSession = () => {
  try {
    return localStorage.getItem(ACCESS_KEY);
  } catch (e) {
    return memSession;
  }
};
// The remembered login, if its code is still on its list. Older versions
// stored just the scrambled access code: that is an author login.
function readSession() {
  const v = savedSession();
  if (!v) return null;
  let s = null;
  try {
    s = JSON.parse(v);
  } catch (e) {}
  if (!s || typeof s != "object") s = { r: "author", id: v };
  const hit = (roleLists()[s.r] || []).find((x) => x[1] === s.id);
  return hit
    ? { r: s.r, id: s.id, name: hit[0], who: String(s.who || "").trim() }
    : null;
}
// Logged in with a valid code and a name (who). An older login without a
// name asks for it (see showLock).
function hasAccess() {
  if (noCodes()) {
    SESSION = { r: "admin", id: "", name: "", who: "" };
    return true;
  }
  SESSION = readSession();
  // A login left unused for too long (even with the browser closed) has ended.
  if (SESSION && Date.now() - lastSeen() >= IDLE_MS) {
    queueAct(
      actEntry(
        "login",
        `Logged out automatically after ${Math.round(IDLE_MS / 60000)} minutes without activity`,
        SESSION,
      ),
    );
    endLogin(true);
    return false;
  }
  return !!SESSION && !!SESSION.who;
}
const isAdmin = () => !!SESSION && SESSION.r == "admin";
const isApprover = () => !!SESSION && SESSION.r == "approver";
// Name and PDF reference of the code that is logged in ("" when none).
const accessName = () => (SESSION ? SESSION.name : "");
const accessRef = () => (SESSION && SESSION.id ? codeRef(SESSION.id) : "");

// Forget the login. idle = it ended after no activity (the login screen says so).
function endLogin(idle) {
  try {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(ACTIVE_KEY);
    if (idle) sessionStorage.setItem("sp-idle-out", "1");
  } catch (e) {}
  memSession = null;
  SESSION = null;
  APCODE = "";
}
// Log out (idle = automatically): note it in the activity log, then reload.
async function logout(idle) {
  try {
    if (DATA_READY) {
      flushItem();
      logAct(
        "login",
        idle
          ? `Logged out automatically after ${Math.round(IDLE_MS / 60000)} minutes without activity`
          : "Logged out",
      );
      await writeNow();
    } else if (SESSION && SESSION.who)
      queueAct(
        actEntry("login", idle ? "Logged out automatically" : "Logged out"),
      );
  } catch (e) {}
  endLogin(idle);
  location.reload();
}

// ---------- Automatic log-out ----------
// After IDLE_MS without a click, key press, touch or scroll (in any tab of the
// app), the login ends, so a forgotten login on a shared computer does not
// stay open. A warning with "Stay logged in" shows one minute before.
// Everything is saved as it is typed, so no work is lost.
const ACTIVE_KEY = "sp-active"; // time of the last activity (shared by tabs)
let IDLE_MS = 30 * 60 * 1000,
  lastActive = 0, // in this tab (0 = nothing yet)
  lastWrite = 0,
  idleTimer = null;
// Last activity in any tab. No record at all (e.g. a login from before this
// feature) counts as active now.
const lastSeen = () => {
  let t = 0;
  try {
    t = +localStorage.getItem(ACTIVE_KEY) || 0;
  } catch (e) {}
  return Math.max(t, lastActive) || Date.now();
};
function markActive() {
  lastActive = Date.now();
  if (lastActive - lastWrite > 10000) {
    lastWrite = lastActive;
    try {
      localStorage.setItem(ACTIVE_KEY, String(lastActive));
    } catch (e) {}
  }
  const w = $("#idlewarn");
  if (w) w.remove();
}
function checkIdle() {
  if (!SESSION || !SESSION.name) return;
  const left = IDLE_MS - (Date.now() - lastSeen());
  if (left <= 0) return logout(true);
  if (left <= Math.min(60000, IDLE_MS / 2) && !$("#idlewarn")) {
    const w = document.createElement("div");
    w.id = "idlewarn";
    w.setAttribute("role", "alertdialog");
    w.innerHTML = `<span>No activity: you will be logged out in less than a minute.</span><button class="tb" data-stay="1">Stay logged in</button>`;
    document.body.append(w);
    w.querySelector("button").focus();
  }
}
function startIdleWatch() {
  if (!SESSION || !SESSION.name || idleTimer) return;
  markActive();
  for (const ev of ["pointerdown", "keydown", "wheel", "touchstart", "input"])
    document.addEventListener(ev, markActive, { capture: true, passive: true });
  idleTimer = setInterval(checkIdle, Math.min(5000, IDLE_MS / 4));
}

// "Logged in: Author · Code 4   Log out", at the top of every page.
const userBar = () =>
  SESSION && SESSION.name
    ? `<div class="ubar"><span class="m">Logged in: <b>${esc(SESSION.who || SESSION.name)}</b> · ${ROLE_NAMES[SESSION.r]}${SESSION.who ? ` (${esc(SESSION.name)})` : ""}</span><button class="lk" data-a="logout">Log out</button></div>`
    : "";

// Which code is this? -> { r, id, name } or null. Approver codes are checked
// through their signing key (see apKeys).
async function findCode(code) {
  const h = codeHash(code);
  for (const r of ["admin", "author"]) {
    const hit = roleLists()[r].find((x) => x[1] === h);
    if (hit) return { r, id: h, name: hit[0] };
  }
  if (APPROVERS.length && normCode(code).length >= 6 && subtle()) {
    try {
      const { pub } = await apKeys(code),
        hit = APPROVERS.find((x) => x[1] === pub);
      if (hit) return { r: "approver", id: pub, name: hit[0] };
    } catch (e) {}
  }
  return null;
}

// Show the login screen; calls open() once a valid code is entered.
let JUST_LOGGED = false; // a new login: noted in the activity log at start-up
const NAMES_KEY = "sp-names"; // last name typed with each code, on this computer

function showLock(open) {
  const pend = readSession(); // logged in, but no name yet (older login)
  if (pend && !pend.who) return askName(pend, open);
  const old = savedSession();
  let idle = false;
  try {
    idle = sessionStorage.getItem("sp-idle-out") == "1";
    sessionStorage.removeItem("sp-idle-out");
  } catch (e) {}
  $("#app").innerHTML =
    `<form id="lock" class="lock" autocomplete="off"><h1>Setup Procedures</h1>` +
    `<p class="m">Log in with your code: an access code, admin code or approver code.</p>` +
    (idle
      ? `<p class="note">You were logged out after ${Math.round(IDLE_MS / 60000)} minutes without activity. Your work was saved.</p>`
      : old
        ? `<p class="err">Your code no longer works. Ask for a new one.</p>`
        : "") +
    `<label class="f">Your code<input id="lockCode" type="password" autocomplete="off" autocapitalize="characters" spellcheck="false" required></label>` +
    `<p class="err" id="lockErr" role="alert"></p>` +
    `<button class="b" type="submit">Log in</button>` +
    `<p class="m">On a shared computer, press <b>Log out</b> (top of every page) when you finish.</p></form>`;
  const form = $("#lock"),
    input = $("#lockCode");
  input.focus();
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = form.querySelector("button"),
      code = input.value;
    btn.disabled = true;
    // A short wait makes guessing slow.
    const [s] = await Promise.all([
      findCode(code),
      new Promise((r) => setTimeout(r, 600)),
    ]);
    btn.disabled = false;
    if (!s) {
      queueAct(actEntry("login", "Failed login: wrong code", null));
      $("#lockErr").textContent =
        "That code is not right. Check it and try again.";
      input.select();
      return;
    }
    if (s.r == "approver") APCODE = code;
    askName(s, open);
  });
}

// Second step: "Who are you?" The name is shown at the top of every page,
// fills in "Prepared by" and is recorded in the logs with the code.
function askName(s, open) {
  let names = {};
  try {
    names = JSON.parse(localStorage.getItem(NAMES_KEY) || "{}") || {};
  } catch (e) {}
  $("#app").innerHTML =
    `<form id="lock" class="lock" autocomplete="off"><h1>Who are you?</h1>` +
    `<p class="m">Code accepted: <b>${ROLE_NAMES[s.r]}</b> (${esc(s.name)}). Enter your name. It is shown at the top of every page and recorded with what you do.</p>` +
    `<label class="f">Your name<input id="lockName" maxlength="60" autocomplete="name" value="${esc(names[s.id] || "")}" required></label>` +
    `<p class="err" id="lockErr" role="alert"></p>` +
    `<button class="b" type="submit">Continue</button> <button class="lk" type="button" data-relog="1">Use another code</button></form>`;
  const input = $("#lockName");
  input.focus();
  input.select();
  $("[data-relog]").addEventListener("click", () => {
    endLogin(false);
    showLock(open);
  });
  $("#lock").addEventListener("submit", (e) => {
    e.preventDefault();
    const who = input.value.trim().replace(/\s+/g, " ");
    if (who.length < 2) {
      $("#lockErr").textContent = "Enter your name.";
      return;
    }
    names[s.id] = who;
    try {
      localStorage.setItem(NAMES_KEY, JSON.stringify(names));
    } catch (x) {}
    SESSION = { ...s, who };
    const v = JSON.stringify({ r: s.r, id: s.id, who });
    memSession = v;
    try {
      localStorage.setItem(ACCESS_KEY, v);
    } catch (x) {}
    JUST_LOGGED = true;
    open();
  });
}
