// Offline support. Only used when the app is opened from a web address
// (http or https); opening index.html as a file works offline anyway.
// Every app file is stored on first visit. Online, the newest files are
// fetched (and stored again); offline, the stored copies are used.
// Add new app files to FILES and change VERSION when this list changes.
const VERSION = "v6";
const CACHE = "setup-procedures-" + VERSION;
const FILES = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/styles.css",
  "vendor/fonts/fonts.css",
  "vendor/fonts/ibm-plex-sans-latin-400-normal.woff2",
  "vendor/fonts/ibm-plex-sans-latin-600-normal.woff2",
  "vendor/fonts/ibm-plex-sans-latin-700-normal.woff2",
  "vendor/fonts/ibm-plex-sans-latin-ext-400-normal.woff2",
  "vendor/fonts/ibm-plex-sans-latin-ext-600-normal.woff2",
  "vendor/fonts/ibm-plex-sans-latin-ext-700-normal.woff2",
  "vendor/jspdf/jspdf.umd.min.js",
  "js/utils.js",
  "js/storage.js",
  "js/zip.js",
  "js/state.js",
  "js/ppe.js",
  "js/views.js",
  "js/undo.js",
  "js/transfer.js",
  "js/pdf.js",
  "js/log.js",
  "js/markup.js",
  "js/approval.js",
  "js/activity.js",
  "js/events.js",
  "js/access.js",
  "js/admins.js",
  "js/approvers.js",
  "js/lock.js",
  "js/app.js",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/maskable-512.png",
  "icons/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(FILES))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("setup-procedures-") && k != CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// Network first, so updates show up straight away when online; the stored
// copy is used when the network fails.
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method != "GET" || new URL(req.url).origin != location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches
          .match(req, { ignoreSearch: true })
          .then((r) => r || caches.match("index.html")),
      ),
  );
});
