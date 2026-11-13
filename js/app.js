// Setup Procedures app start-up. The app is split into classic scripts that
// share globals (see index.html for the load order):
//   state.js    state, saving, view settings
//   ppe.js      safety equipment (PPE) signs
//   views.js    screens and R()
//   undo.js     undo stack and toast bar
//   transfer.js export & import (.zip)
//   pdf.js      PDF export
//   events.js   click / input / change handlers
// Start: load saved data, then show the first screen.
loadView();
Store.load().then((d) => {
  initState(d);
  R();
});

// Offline support when opened from a web address (not needed for file://).
if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol))
  navigator.serviceWorker.register("sw.js").catch(() => {});
