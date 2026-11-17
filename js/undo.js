// ---------- Undo ----------
// Before a removal or replacement, remember(message) keeps a copy of the data
// and of the page you are on, and shows "message · Undo" at the bottom for 10 s.
// Undo (or Ctrl+Z / ⌘Z outside text fields) puts it back. Up to 20 steps; kept
// until the page is closed or reloaded. Photos are shared, not copied, so this
// stays light.
const UNDO = [];
const copyData = (o) =>
  Array.isArray(o)
    ? o.map(copyData)
    : o && typeof o == "object"
      ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, copyData(v)]))
      : o;
function remember(msg) {
  UNDO.push({ S: copyData(S), T, V: { ...V }, MID, msg });
  if (UNDO.length > 20) UNDO.shift();
  toast(msg, true);
}
async function undo() {
  const u = UNDO.pop();
  if (!u) return;
  // The logs are not undone (except clearing them).
  const log = S.log,
    act = S.act;
  S = u.S;
  if (u.msg != "Print log cleared") S.log = log;
  if (u.msg != "Activity log cleared") S.act = act;
  T = u.T;
  V = u.V;
  MID = u.MID;
  IMP = null;
  R(); // show it straight away, then save
  toast(`Undone: ${u.msg}`, false);
  logAct("change", `Undone: ${u.msg}`);
  await writeNow();
}
let toastTimer = null;
function toast(msg, canUndo) {
  let el = $("#toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    document.body.append(el);
  }
  el.innerHTML = `<span>${esc(msg)}</span>${canUndo ? `<button class="tb" data-undo="1">Undo</button>` : ""}<button class="tx" data-tclose="1" aria-label="Close">✕</button>`;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), canUndo ? 10000 : 4000);
}
// The toast is outside #app, so it has its own click handling.
document.addEventListener("click", (e) => {
  if (e.target.closest("[data-undo]")) undo();
  else if (e.target.closest("[data-tclose]")) $("#toast").hidden = true;
});
// Keep the bar while the mouse is over it or it has keyboard focus.
document.addEventListener("mouseover", (e) => {
  if (e.target.closest && e.target.closest("#toast")) clearTimeout(toastTimer);
});
document.addEventListener("focusin", (e) => {
  if (e.target.closest && e.target.closest("#toast")) clearTimeout(toastTimer);
});
document.addEventListener("keydown", (e) => {
  if (
    e.key.toLowerCase() != "z" ||
    !(e.ctrlKey || e.metaKey) ||
    e.shiftKey ||
    e.altKey
  )
    return;
  const tg = e.target,
    typing =
      tg &&
      (tg.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName));
  if (typing || !UNDO.length) return; // text fields keep their own undo
  e.preventDefault();
  undo();
});
