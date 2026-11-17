// Browser tests: drive the real app in Chromium with Playwright.
// Run: npm run test:e2e   (needs the "playwright" package and Chromium; see README)
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");
const { codeHash } = require("../../js/utils.js");

const ROOT = path.resolve(__dirname, "../..");
const APP = "file://" + path.join(ROOT, "index.html");
const PHOTO = path.join(ROOT, "tests/fixtures/photo.jpg");
// A valid access code (scrambled), so tests start past the access code screen.
const ACCESS =
  (fs
    .readFileSync(path.join(ROOT, "js/access.js"), "utf8")
    .match(/"([0-9a-f]{64})"/) || [])[1] || "";
let browser;

before(async () => {
  browser = await chromium.launch();
});
after(async () => {
  await browser.close();
});

// A fresh browser (empty storage). Any request to the internet is blocked and
// recorded, so every test also checks that the app works offline.
async function open(url = APP, opts = {}) {
  const ctx = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: opts.width || 900, height: 1000 },
  });
  const external = [];
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => {
    external.push(r.request().url());
    return r.abort();
  });
  if (opts.access !== false)
    await ctx.addInitScript(
      (h) => localStorage.setItem("sp-access", h),
      ACCESS,
    );
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.accept());
  await page.goto(url);
  return { ctx, page, errors, external };
}

async function setupCompany(page) {
  await page.fill("[data-co=name]", "ACME Ltd");
  await page.fill('[data-dept="0"]', "Press Shop");
  await page.click("[data-a=coDone]");
}

async function newProduct(page, name = "Widget A") {
  await page.click("[data-a=tab][data-t=p]");
  await page.fill("#nw", "Line 1");
  await page.click("[data-a=addL]");
  await page.fill("#nw", name);
  await page.click("[data-a=addP]");
}

// Save a download and return its bytes as a latin1 string (jsPDF writes
// text uncompressed, so printed text can be searched for directly).
async function download(page, click) {
  const [dl] = await Promise.all([page.waitForEvent("download"), click()]);
  const file = await dl.path();
  return { name: dl.suggestedFilename(), bytes: fs.readFileSync(file) };
}

const pdfText = (bytes) => bytes.toString("latin1");
const pageCount = (s) => (s.match(/\/Type \/Page\b/g) || []).length;

test("first visit asks for company details, then shows the home page", async () => {
  const { ctx, page, errors } = await open();
  assert.match(await page.textContent("h1"), /Welcome/);
  await setupCompany(page);
  assert.match(await page.textContent("#app"), /ACME Ltd/);
  assert.ok(await page.isVisible("[data-a=tab][data-t=p]"));
  assert.ok(await page.isVisible("[data-a=tab][data-t=m]"));
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("a full product prints to PDF with PPE signs, tools, steps and notes, without internet", async () => {
  const { ctx, page, errors, external } = await open();
  await setupCompany(page);
  await newProduct(page);
  await page.fill("[data-f=code]", "WA-1");
  await page.setInputFiles('[data-up="prod"]', PHOTO);
  await page.waitForSelector(".g img");

  // Safety equipment
  await page.check('[data-ppe="glasses"]');
  await page.check('[data-ppe="gloves"]');
  await page.check('[data-ppe="shoes"]');
  await page.fill("[data-f=ppeo]", "Cut-resistant sleeves");
  assert.equal(await page.locator(".pp.on").count(), 3);

  // Tools
  await page.click("[data-a=addTool]");
  await page.keyboard.type("Torque wrench");
  await page.keyboard.press("Tab");
  await page.keyboard.type("10-60 Nm");

  // Steps, sub-step, warning
  await page.fill('[data-h="0"]', "Fit the die");
  await page.fill('[data-s="0"]', "Tighten the clamps to 25 Nm.");
  await page.setInputFiles('[data-up="step"][data-i="0"]', PHOTO);
  await page.waitForSelector('[data-a="rmSI"][data-i="0"]');
  await page.click('[data-a=addW][data-i="0"]:not([data-j])');
  await page.fill(
    '[data-w="0"]:not([data-wj])',
    "Keep hands clear of the press.",
  );
  await page.click('[data-a=addSub][data-i="0"]');
  await page.fill('[data-ss="0"][data-sj="0"]', "Check the clamp pressure.");
  await page.click("[data-a=addS]");
  await page.fill('[data-s="1"]', "Run one test part.");

  await page.fill("[data-f=by]", "Alex");
  await page.fill("[data-f=appr]", "Sam");
  await page.check("[data-wm]");
  const { name, bytes } = await download(page, () =>
    page.click("[data-a=pdf]"),
  );
  const s = pdfText(bytes);
  assert.equal(name, "Widget_A_rev1.pdf");
  assert.ok(s.startsWith("%PDF"));
  for (const t of [
    "Widget A",
    "Safety equipment required",
    "Safety glasses",
    "Gloves",
    "Safety shoes",
    "Also required: Cut-resistant sleeves",
    "Tools required",
    "Torque wrench",
    "Fit the die",
    "Keep hands clear of the press.",
    "Check the clamp pressure.",
    "Run one test part.",
  ])
    assert.ok(s.includes(t), `PDF should contain "${t}"`);
  assert.ok(!s.includes("Ear protection"), "unticked PPE is not printed");
  const ref = "Ref " + ACCESS.slice(0, 6).toUpperCase();
  assert.ok(
    s.includes(ref + "   Page 1 of"),
    "footer shows the access code reference",
  );
  assert.ok(
    s.includes("/Keywords (" + ref),
    "file properties show the reference",
  );
  assert.ok(
    s.includes("(" + ref + " printed "),
    "hidden text has the reference",
  );
  assert.ok(s.includes("3 Tr"), "hidden text is drawn invisible");
  assert.ok(
    s.includes("(" + ref.toUpperCase() + ")"),
    "watermark has the reference",
  );
  assert.ok(pageCount(s) >= 1);

  assert.deepEqual(external, [], "no internet requests");
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("changes are kept after reloading the page", async () => {
  const { ctx, page, errors } = await open();
  await setupCompany(page);
  await newProduct(page);
  await page.check('[data-ppe="ear"]');
  await page.fill('[data-s="0"]', "Saved text");
  await page.waitForTimeout(300);
  await page.reload();
  await page.click("[data-a=tab][data-t=p]");
  await page.click("[data-a=openL]");
  await page.click('.card:has-text("Widget A")');
  assert.equal(await page.inputValue('[data-s="0"]'), "Saved text");
  assert.ok(await page.isChecked('[data-ppe="ear"]'));
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("removing a step can be undone", async () => {
  const { ctx, page, errors } = await open();
  await setupCompany(page);
  await newProduct(page);
  await page.fill('[data-s="0"]', "First");
  await page.click("[data-a=addS]");
  await page.fill('[data-s="1"]', "Second");
  await page.click('[data-a=rmS][data-i="0"]');
  assert.equal(await page.locator("[data-s]").count(), 1);
  assert.match(await page.textContent("#toast"), /Step 1 deleted/);
  await page.click("#toast [data-undo]");
  assert.equal(await page.locator("[data-s]").count(), 2);
  assert.equal(await page.inputValue('[data-s="0"]'), "First");
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("home search finds a product", async () => {
  const { ctx, page, errors } = await open();
  await setupCompany(page);
  await newProduct(page, "Gearbox housing");
  await page.click("[data-a=openL]");
  await page.click("[data-a=home]");
  await page.click("[data-a=goHome]");
  await page.fill("[data-hs]", "gearbox");
  await page.press("[data-hs]", "Enter");
  assert.equal(await page.inputValue("[data-f=name]"), "Gearbox housing");
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("a machine prints to PDF", async () => {
  const { ctx, page, errors } = await open();
  await setupCompany(page);
  await page.click("[data-a=tab][data-t=m]");
  await page.fill("#nw", "Press 3");
  await page.click("[data-a=addM]");
  await page.check('[data-ppe="helmet"]');
  await page.fill('[data-s="0"]', "Switch off the main power.");
  await page.fill("[data-f=by]", "Alex");
  await page.fill("[data-f=appr]", "Sam");
  const { bytes } = await download(page, () => page.click("[data-a=pdf]"));
  const s = pdfText(bytes);
  for (const t of [
    "Press 3",
    "Machine",
    "Hard hat",
    "Switch off the main power.",
  ])
    assert.ok(s.includes(t), `PDF should contain "${t}"`);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("a full backup exports and imports into another browser, with photos and PPE", async () => {
  const a = await open();
  await setupCompany(a.page);
  await newProduct(a.page);
  await a.page.check('[data-ppe="mask"]');
  await a.page.setInputFiles('[data-up="step"][data-i="0"]', PHOTO);
  await a.page.waitForSelector('[data-a="rmSI"][data-i="0"]');
  await a.page.click("[data-a=openL]");
  await a.page.click("[data-a=home]");
  await a.page.click("[data-a=goHome]");
  await a.page.click("[data-a=goX]");
  const zip = await download(a.page, () => a.page.click("[data-a=xExport]"));
  assert.match(zip.name, /^setup-procedures-backup-\d{4}-\d{2}-\d{2}\.zip$/);
  const zipFile = path.join(
    fs.mkdtempSync(path.join(require("os").tmpdir(), "sp-")),
    zip.name,
  );
  fs.writeFileSync(zipFile, zip.bytes);

  const b = await open(APP, { width: 375 });
  await b.page.setInputFiles("[data-imp]", zipFile);
  await b.page.click("[data-a=iDo]");
  await b.page.waitForSelector(".ok");
  const item = await b.page.evaluate(() => {
    const p = S.lines[0].products[0];
    return {
      name: p.name,
      ppe: p.ppe,
      photo: p.steps[0].img.slice(0, 15),
      co: S.co.name,
    };
  });
  assert.deepEqual(item, {
    name: "Widget A",
    ppe: ["mask"],
    photo: "data:image/jpeg",
    co: "ACME Ltd",
  });
  assert.deepEqual(a.errors, []);
  assert.deepEqual(b.errors, []);
  await a.ctx.close();
  await b.ctx.close();
});

// Serve the app on a local web address. `files` replaces files by path, for
// example { "/js/access.js": "const ACCESS_CODES = [];" }, and can be changed
// while the server runs.
async function serve(files = {}) {
  const types = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".webmanifest": "application/manifest+json",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".woff2": "font/woff2",
  };
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (files[rel] !== undefined) {
      res.writeHead(200, {
        "content-type": "text/javascript",
        "cache-control": "no-store",
      });
      res.end(files[rel]);
      return;
    }
    const file = path.join(ROOT, rel.endsWith("/") ? rel + "index.html" : rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file)) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, {
      "content-type": types[path.extname(file)] || "application/octet-stream",
    });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return {
    url: `http://127.0.0.1:${server.address().port}/`,
    files,
    close: () => server.close(),
  };
}

test("without a code only the access code screen shows", async () => {
  const { ctx, page, errors } = await open(APP, { access: false });
  assert.ok(await page.isVisible("#lockCode"));
  assert.doesNotMatch(await page.textContent("#app"), /Welcome/);
  await page.fill("#lockCode", "WRONG-CODE");
  await page.click("#lock button");
  await page.waitForSelector("#lockErr:not(:empty)");
  assert.ok(await page.isVisible("#lockCode"));
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("a correct code opens the app, is remembered, and stops working when removed", async () => {
  const list = (codes) =>
    `const ACCESS_CODES = [${codes.map((c) => `["t", "${codeHash(c)}"]`).join(",")}];`;
  const site = await serve({
    "/js/access.js": list(["TEST-CODE-1", "OTHER-CODE-2"]),
  });
  try {
    const { ctx, page, errors } = await open(site.url, { access: false });
    await page.fill("#lockCode", "test code 1"); // case, spaces and dashes don't matter
    await page.click("#lock button");
    await page.waitForSelector("[data-co=name]");
    assert.match(await page.textContent("h1"), /Welcome/);
    await page.reload();
    await page.waitForSelector("[data-co=name]"); // remembered
    site.files["/js/access.js"] = list(["OTHER-CODE-2"]);
    await page.reload();
    await page.waitForSelector("#lockCode");
    assert.match(await page.textContent("#lock"), /no longer works/);
    await page.fill("#lockCode", "OTHER-CODE-2");
    await page.click("#lock button");
    await page.waitForSelector("[data-co=name]");
    assert.deepEqual(errors, []);
    await ctx.close();
  } finally {
    site.close();
  }
});

// Served from a web address, the app installs a service worker and then
// opens and makes PDFs with no network at all.
test("from a web address the app works offline after the first visit", async () => {
  const site = await serve(),
    url = site.url;
  try {
    const { ctx, page, errors } = await open(url);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload(); // now controlled by the service worker
    assert.ok(await page.evaluate(() => !!navigator.serviceWorker.controller));
    await ctx.setOffline(true);
    await page.reload();
    assert.match(await page.textContent("h1"), /Welcome/);
    await setupCompany(page);
    await newProduct(page);
    await page.check('[data-ppe="vest"]');
    await page.fill("[data-f=by]", "Alex");
    await page.fill("[data-f=appr]", "Sam");
    const { bytes } = await download(page, () => page.click("[data-a=pdf]"));
    assert.ok(pdfText(bytes).includes("Hi-vis vest"));
    assert.deepEqual(errors, []);
    await ctx.close();
  } finally {
    site.close();
  }
});
