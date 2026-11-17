// Setup Procedures app start-up. The app is split into classic scripts that
// share globals (see index.html for the load order):
//   state.js    state, saving, view settings
//   ppe.js      safety equipment (PPE) signs
//   views.js    screens and R()
//   undo.js     undo stack and toast bar
//   transfer.js export & import (.zip)
//   pdf.js      PDF export
//   log.js      print log;  markup.js  photo markup
//   approval.js draft / approval requests and signed approvals
//   approvers.js approvers' public keys
//   events.js   click / input / change handlers
//   access.js   access codes (scrambled);  lock.js  access code screen
// Start: ask for the access code if needed, then load saved data and show
// the first screen.
loadView();
const startApp = () =>
  Store.load().then((d) => {
    initState(d);
    if (isApprover()) T = "ap";
    R();
  });
if (hasAccess()) startApp();
else showLock(startApp);

// Offline support when opened from a web address (not needed for file://).
if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol))
  navigator.serviceWorker.register("sw.js").catch(() => {});
