// Saved data. Uses IndexedDB, which allows hundreds of MB or more. Falls back
// to localStorage (about 5 MB) where IndexedDB is not available. Data saved by
// older versions in localStorage is moved to IndexedDB on first load.
//
// In IndexedDB each photo is its own record ("img:<id>") and the main record
// ("state") holds only references, so saving a text change stays small and fast
// however many photos there are. The app itself always sees full image data.
const Store = (() => {
  let db = null;
  const ids = new Map(), // image data -> record key
    stored = new Set(); // image record keys in the database

  const isImg = (v) => typeof v == "string" && v.startsWith("data:image/");
  const isRef = (v) => typeof v == "string" && v.startsWith("img:");

  // Copy of S with every image value passed through fn (photos, step photos, logo).
  const mapImgs = (S, test, fn) => {
    const c = (v) => (test(v) ? fn(v) : v);
    const item = (p) => ({
      ...p,
      prod: (p.prod || []).map(c).filter(Boolean),
      pack: (p.pack || []).map(c).filter(Boolean),
      steps: (p.steps || []).map((s) => ({ ...s, img: c(s.img) || "" })),
    });
    const out = {
      ...S,
      lines: (S.lines || []).map((l) => ({
        ...l,
        products: (l.products || []).map(item),
      })),
      machines: (S.machines || []).map(item),
    };
    if (S.logo !== undefined) out.logo = c(S.logo) || undefined;
    if (out.logo === undefined) delete out.logo;
    return out;
  };

  const req = (r) =>
    new Promise((res, rej) => {
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });

  const open = () =>
    new Promise((res, rej) => {
      const r = indexedDB.open("setup-procedures", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("kv");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
      r.onblocked = () => rej(new Error("blocked"));
    });

  // Returns the saved state object, or {} when nothing is saved yet.
  async function load() {
    let data = null;
    try {
      db = await open();
      const os = db.transaction("kv").objectStore("kv");
      const [state, keys] = await Promise.all([
        req(os.get("state")),
        req(os.getAllKeys()),
      ]);
      keys.filter(isRef).forEach((k) => stored.add(k));
      if (state) {
        const want = new Set();
        mapImgs(state, isRef, (k) => (want.add(k), k));
        const os2 = db.transaction("kv").objectStore("kv"),
          imgs = new Map();
        await Promise.all(
          [...want].map(async (k) => imgs.set(k, await req(os2.get(k)))),
        );
        data = mapImgs(state, isRef, (k) => {
          const v = imgs.get(k);
          if (v) ids.set(v, k);
          return v || "";
        });
      }
    } catch (e) {
      db = null;
    }
    if (!data) {
      try {
        data = JSON.parse(localStorage.getItem("sp") || "null");
      } catch (e) {}
      if (data && db) {
        try {
          await write(data);
          localStorage.removeItem("sp");
        } catch (e) {}
      }
    }
    return data || {};
  }

  // Saves the whole state. Throws when storage is full.
  function write(S) {
    if (!db) {
      localStorage.setItem("sp", JSON.stringify(S));
      return Promise.resolve();
    }
    const refs = new Set(),
      add = new Map();
    const slim = mapImgs(S, isImg, (v) => {
      let k = ids.get(v);
      if (!k) {
        k =
          "img:" +
          Date.now().toString(36) +
          Math.random().toString(36).slice(2, 8);
        ids.set(v, k);
      }
      refs.add(k);
      if (!stored.has(k)) add.set(k, v);
      return k;
    });
    const del = [...stored].filter((k) => !refs.has(k));
    return new Promise((res, rej) => {
      const tx = db.transaction("kv", "readwrite"),
        os = tx.objectStore("kv");
      add.forEach((v, k) => os.put(v, k));
      os.put(slim, "state");
      del.forEach((k) => os.delete(k));
      tx.oncomplete = () => {
        add.forEach((v, k) => stored.add(k));
        del.forEach((k) => stored.delete(k));
        ids.forEach((k, v) => {
          if (!refs.has(k)) ids.delete(v);
        });
        res();
      };
      tx.onerror = tx.onabort = () => {
        // Forget keys for images that were not saved, so they are retried.
        add.forEach((v, k) => ids.delete(v));
        rej(tx.error || new Error("write failed"));
      };
    });
  }

  // { used, free, big } in bytes. big = false means the small localStorage limit.
  async function info(S) {
    const json = JSON.stringify(S),
      used = new Blob([json]).size;
    if (db && navigator.storage && navigator.storage.estimate) {
      try {
        const e = await navigator.storage.estimate();
        if (e.quota)
          return { used, free: Math.max(0, e.quota - e.usage), big: true };
      } catch (e) {}
    }
    const cap = 5 * 1024 * 1024; // localStorage holds about 5 million characters
    return { used, free: Math.max(0, cap - json.length), big: false };
  }

  // Ask the browser not to clear this data automatically when space runs low.
  const persist = () => {
    try {
      if (navigator.storage && navigator.storage.persist)
        navigator.storage.persist();
    } catch (e) {}
  };

  return { load, write, info, persist };
})();
