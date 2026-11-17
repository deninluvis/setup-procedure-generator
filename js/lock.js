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
  return hit ? { r: s.r, id: s.id, name: hit[0] } : null;
}
function hasAccess() {
  SESSION = noCodes() ? { r: "admin", id: "", name: "" } : readSession();
  return !!SESSION;
}
const isAdmin = () => !!SESSION && SESSION.r == "admin";
const isApprover = () => !!SESSION && SESSION.r == "approver";
// Name and PDF reference of the code that is logged in ("" when none).
const accessName = () => (SESSION ? SESSION.name : "");
const accessRef = () => (SESSION && SESSION.id ? codeRef(SESSION.id) : "");

function logout() {
  try {
    localStorage.removeItem(ACCESS_KEY);
  } catch (e) {}
  memSession = null;
  SESSION = null;
  APCODE = "";
  location.reload();
}

// "Logged in: Author · Code 4   Log out", at the top of every page.
const userBar = () =>
  SESSION && SESSION.name
    ? `<div class="ubar"><span class="m">Logged in: <b>${ROLE_NAMES[SESSION.r]}</b> · ${esc(SESSION.name)}</span><button class="lk" data-a="logout">Log out</button></div>`
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
function showLock(open) {
  const old = savedSession();
  $("#app").innerHTML =
    `<form id="lock" class="lock" autocomplete="off"><h1>Setup Procedures</h1>` +
    `<p class="m">Log in with your code: an access code, admin code or approver code.</p>` +
    (old
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
      $("#lockErr").textContent =
        "That code is not right. Check it and try again.";
      input.select();
      return;
    }
    SESSION = s;
    if (s.r == "approver") APCODE = code;
    const v = JSON.stringify({ r: s.r, id: s.id });
    memSession = v;
    try {
      localStorage.setItem(ACCESS_KEY, v);
    } catch (x) {}
    open();
  });
}
