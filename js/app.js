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
//   activity.js activity log, change history, Logs page (admins)
//   events.js   click / input / change handlers
//   access.js   access codes (scrambled);  lock.js  access code screen
// Start: ask for the access code if needed, then load saved data and show
// the first screen.
loadView();
const startApp = () =>
  Store.load()
    .then((d) => {
      initState(d);
      DATA_READY = true;
      flushActQueue();
      if (JUST_LOGGED)
        logAct("login", SESSION.own ? "Logged in (own device)" : "Logged in");
      if (isApprover()) T = "ap";
      R();
      startIdleWatch();
    })
    .catch(() => {
      // The saved data could not be opened (e.g. damaged data or blocked storage).
      $("#app").innerHTML =
        `<h1>Could not open your saved data</h1><p class="err" role="alert">Something went wrong while opening the data saved in this browser. Nothing was deleted.</p><p class="m">Close other tabs of this app and reload. If it keeps happening, check that the browser is not in private mode and allows site data.</p><button class="b" onclick="location.reload()">Reload</button>`;
    });
if (hasAccess()) startApp();
else showLock(startApp);

// Offline support when opened from a web address (not needed for file://).
if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol))
  navigator.serviceWorker.register("sw.js").catch(() => {});
