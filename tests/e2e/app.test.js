// Browser tests: drive the real app in Chromium with Playwright.
// Run: npm run test:e2e   (needs the "playwright" package and Chromium; see README)
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");
const { codeHash, apKeys } = require("../../js/utils.js");

const ROOT = path.resolve(__dirname, "../..");
const APP = "file://" + path.join(ROOT, "index.html");
const PHOTO = path.join(ROOT, "tests/fixtures/photo.jpg");
const PHOTO2 = path.join(ROOT, "tests/fixtures/photo2.jpg");
// A valid access code (scrambled), so tests start past the access code screen.
const ACCESS =
  (fs
    .readFileSync(path.join(ROOT, "js/access.js"), "utf8")
    .match(/"([0-9a-f]{64})"/) || [])[1] || "";
const ADMIN =
  (fs
    .readFileSync(path.join(ROOT, "js/admins.js"), "utf8")
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
  // Logged in as an author (older, plain format) or, with role "admin", as
  // the first admin code.
  if (opts.access !== false)
    await ctx.addInitScript(
      (v) => localStorage.setItem("sp-access", v),
      JSON.stringify(
        opts.role == "admin"
          ? { r: "admin", id: ADMIN, who: "Test User" }
          : { r: "author", id: ACCESS, who: "Test User" },
      ),
    );
  // App-styled questions (ask() in views.js): answer them like the browser's
  // dialogs were, and keep what was asked in ASKED. ASK_ANSWER = "0" cancels.
  await ctx.addInitScript(() => {
    window.ASKED = [];
    new MutationObserver(() => {
      const box = document.querySelector("#ask");
      if (!box || box.dataset.seen || window.ASK_MANUAL) return;
      box.dataset.seen = 1;
      window.ASKED.push(box.querySelector("#askt").textContent);
      const b = box.querySelector(`[data-ask="${window.ASK_ANSWER || "1"}"]`);
      b.click(); // right away, like an accepted browser dialog
    }).observe(document, { childList: true, subtree: true });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.accept());
  await page.goto(url);
  return { ctx, page, errors, external };
}

// Log in on the login screen: code, then name.
async function enterCode(page, code, name = "Test User") {
  await page.waitForSelector("#lockCode");
  await page.fill("#lockCode", code);
  await page.click("#lock button");
  await page.waitForSelector("#lockName");
  await page.fill("#lockName", name);
  await page.click("#lock button");
  await page.waitForSelector("#lockName", { state: "detached" });
}

async function setupCompany(page) {
  await page.fill("[data-co=name]", "ACME Ltd");
  await page.fill('[data-dept="0"]', "Press Shop");
  await page.click("[data-a=coDone]");
}

async function newProduct(page, name = "Widget A") {
  await page.click("[data-a=tab][data-t=p]");
  await typeNew(page, "Line 1");
  await page.click("[data-a=addL]");
  await typeNew(page, name);
  await page.click("[data-a=addP]");
}

// Save a download and return its bytes as a latin1 string (jsPDF writes
// text uncompressed, so printed text can be searched for directly).
async function download(page, click) {
  const [dl] = await Promise.all([page.waitForEvent("download"), click()]);
  const file = await dl.path();
  return { name: dl.suggestedFilename(), bytes: fs.readFileSync(file) };
}

// The ⋮ menu at the top of a line, product or machine page.
async function openMenu(page, m = "t") {
  if (
    !(await page
      .locator(`[data-a=menu][data-m="${m}"][aria-expanded=true]`)
      .count())
  )
    await page.click(`[data-a=menu][data-m="${m}"]`);
}
async function menuClick(page, sel) {
  await openMenu(page);
  await page.click(`.kmenu ${sel}`);
}
// An option in a step's ⋮ (sub-step: m = "u:i:j").
async function stepMenu(page, i, sel, m = `s:${i}`) {
  await openMenu(page, m);
  await page.click(`.kmenu ${sel}`);
}
// Open a step photo full screen (k = "step" or "sub"), e.g. to remove it.
async function viewPhoto(page, i, n, k = "step", j = 0) {
  await page.click(
    `[data-a=view][data-k=${k}][data-i="${i}"]${k == "sub" ? `[data-j="${j}"]` : ""}[data-n="${n}"]`,
  );
  await page.waitForSelector("#pv");
}
async function logoutClick(page) {
  await openMenu(page, "user");
  await page.click(".kmenu [data-a=logout]");
}
// Settings (⚙ in the top bar), then one of its buttons.
async function settings(page, sel) {
  await page.click("[data-a=goSet]");
  if (sel) await page.click(sel);
}

// Type a name into the "＋ New line / product / machine" box (opens it first).
async function typeNew(page, name) {
  if (!(await page.locator("#nw").count()))
    await page.click("[data-a=addOpen]");
  await page.fill("#nw", name);
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
  await page.waitForSelector('[data-a=view][data-k=step][data-i="0"]');
  await stepMenu(page, 0, "[data-a=addW]");
  await page.fill(
    '[data-w="0"]:not([data-wj])',
    "Keep hands clear of the press.",
  );
  await stepMenu(page, 0, "[data-a=addSub]");
  await page.fill('[data-ss="0"][data-sj="0"]', "Check the clamp pressure.");
  await page.click("[data-a=addS]");
  await page.fill('[data-s="1"]', "Run one test part.");

  await page.fill("[data-f=by]", "Alex");
  await openMenu(page);
  await page.check("[data-wm]");
  const { name, bytes } = await download(page, () =>
    menuClick(page, "[data-a=pdf]"),
  );
  const s = pdfText(bytes);
  assert.match(
    name,
    /^Widget A - WA-1 - Rev 1 - \d{4}-\d{2}-\d{2} - DRAFT\.pdf$/,
  );
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
    !s.includes(ref + "   Page"),
    "footer does not print the reference",
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
    !s.includes("(" + ref.toUpperCase() + ")"),
    "watermark has no reference",
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

test("a step and a sub-step take several photos, each removable, all in the PDF", async () => {
  const { ctx, page, errors } = await open();
  await setupCompany(page);
  await newProduct(page);
  await page.fill('[data-s="0"]', "Fit the die");
  // Two photos at once, then one more.
  await page.setInputFiles('[data-up="step"][data-i="0"]', [PHOTO, PHOTO2]);
  await page.waitForSelector(
    '[data-a=view][data-k=step][data-i="0"][data-n="1"]',
  );
  await page.setInputFiles('[data-up="step"][data-i="0"]', PHOTO);
  await page.waitForSelector(
    '[data-a=view][data-k=step][data-i="0"][data-n="2"]',
  );
  assert.equal(await page.locator(".sph.many .simg").count(), 3);
  // Three is the most: the add button is gone.
  assert.equal(await page.locator('[data-up="step"][data-i="0"]').count(), 0);
  assert.match(await page.textContent(".box"), /3 photos is the most/);
  assert.equal(await page.evaluate(() => P().steps[0].more.length), 2);
  await stepMenu(page, 0, "[data-a=addSub]");
  // Picking four adds only three.
  await page.setInputFiles('[data-up="sub"][data-i="0"][data-j="0"]', [
    PHOTO,
    PHOTO2,
    PHOTO,
    PHOTO2,
  ]);
  await page.waitForSelector(
    '[data-a=view][data-k=sub][data-j="0"][data-n="2"]',
  );
  assert.equal(await page.evaluate(() => P().steps[0].subs[0].more.length), 2);

  const { bytes } = await download(page, () => menuClick(page, "[data-a=pdf]"));
  const imgs = (pdfText(bytes).match(/\/Subtype \/Image/g) || []).length;
  assert.ok(imgs >= 2, `PDF should hold the photos (found ${imgs} images)`);

  // Removing the first photo moves the next one up; Undo brings it back.
  const first = await page.evaluate(() => P().steps[0].img);
  await viewPhoto(page, 0, 0);
  await page.click("#pv [data-a=rmSI]");
  assert.equal(
    await page.locator('[data-a=view][data-k=step][data-i="0"]').count(),
    2,
  );
  assert.notEqual(await page.evaluate(() => P().steps[0].img), first);
  await page.click("#toast [data-undo]");
  assert.equal(await page.evaluate(() => P().steps[0].img), first);
  assert.equal(
    await page.locator('[data-a=view][data-k=step][data-i="0"]').count(),
    3,
  );
  // Down to one photo: the extra list goes away.
  await viewPhoto(page, 0, 2);
  await page.click("#pv [data-a=rmSI]");
  await viewPhoto(page, 0, 1);
  await page.click("#pv [data-a=rmSI]");
  assert.equal(await page.evaluate(() => P().steps[0].more), undefined);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("a line can be renamed, and a second line with the same name is not made", async () => {
  const { ctx, page, errors } = await open();
  await setupCompany(page);
  await newProduct(page);
  await page.click("[data-a=openL]"); // back to the line
  page.removeAllListeners("dialog");
  page.once("dialog", (d) => d.accept("Press line"));
  await menuClick(page, "[data-a=renL]");
  assert.equal(await page.textContent("h1"), "Press line");
  await page.click("[data-a=home]");
  await page.click("[data-a=addOpen]");
  assert.match(
    await page.textContent("#app"),
    /Use the same line name on every computer/,
  );
  page.once("dialog", (d) => d.accept());
  await typeNew(page, " press  LINE ");
  await page.click("[data-a=addL]");
  assert.equal(await page.evaluate(() => S.lines.length), 1);
  assert.equal(
    await page.textContent("h1"),
    "Press line",
    "the existing line opens",
  );
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("empty, validation, success and no-results states", async () => {
  const { ctx, page, errors } = await open(APP, { role: "admin" });
  await setupCompany(page);
  await page.click("[data-a=tab][data-t=p]");
  assert.match(await page.textContent(".empty"), /No product lines yet/);
  // An empty name is not added, and says why.
  await page.click("[data-a=addOpen]");
  await page.click("[data-a=addL]");
  assert.equal(
    await page.$eval("#nw", (el) => el.validationMessage),
    "Enter a line name.",
  );
  assert.equal(await page.evaluate(() => S.lines.length), 0);
  await typeNew(page, "Line 1");
  await page.click("[data-a=addL]");
  assert.match(
    await page.textContent(".empty"),
    /No products in this line yet/,
  );
  await typeNew(page, "Widget A");
  await page.click("[data-a=addP]");
  await page.fill("[data-f=by]", "Alex");
  await download(page, () => menuClick(page, "[data-a=pdf]"));
  await page.waitForSelector("#toast:not([hidden])");
  assert.match(
    await page.textContent("#toast"),
    /PDF saved: Widget A - Rev 1 - \d{4}-\d{2}-\d{2} - DRAFT\.pdf/,
  );
  // Logs filter with no match.
  await page.evaluate(() => {
    T = "log";
    R();
  });
  await page.fill("[data-af]", "zzz-nothing");
  assert.match(await page.textContent(".empty"), /Nothing matches/);
  await page.click("[data-a=afClear]");
  assert.equal(await page.locator(".empty").count(), 0);
  // The ✕ in a search box clears it.
  await page.fill("[data-af]", "zzz");
  await page.click('[data-a=sClear][data-k="af"]');
  assert.equal(await page.inputValue("[data-af]"), "");
  assert.equal(await page.locator(".empty").count(), 0);
  // A product with no steps says how to add one.
  await page.evaluate(() => {
    T = "p";
    V.p = S.lines[0].products[0].id;
    R();
  });
  await stepMenu(page, 0, "[data-a=rmS]");
  assert.match(await page.textContent(".empty"), /No steps yet/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("damaged saved data shows a message instead of a blank page", async () => {
  const { ctx, page } = await open(APP, { role: "admin" });
  await ctx.addInitScript(() => {
    indexedDB.open = () => {
      throw new Error("blocked");
    };
    localStorage.setItem(
      "sp",
      '{"co":{"name":"A","depts":5,"done":true},"lines":7}',
    );
  });
  await page.reload();
  await page.waitForSelector("h1");
  assert.match(await page.textContent("h1"), /Could not open your saved data/);
  assert.match(await page.textContent("#app"), /Nothing was deleted/);
  await ctx.close();
});

test("a product and a machine can be duplicated as separate drafts", async () => {
  const { ctx, page, errors } = await open();
  await setupCompany(page);
  await newProduct(page);
  await page.fill('[data-s="0"]', "Fit the die");
  await page.setInputFiles('[data-up="step"][data-i="0"]', PHOTO);
  await page.waitForSelector('[data-a=view][data-k=step][data-i="0"]');
  await page.evaluate(() => (P().ap = { st: "pending", to: "Approver 1" }));
  await menuClick(page, "[data-a=dupP]");
  assert.match(await page.textContent("#toast"), /Widget A \(copy\)/);
  assert.equal(await page.inputValue("[data-f=name]"), "Widget A (copy)");
  assert.equal(await page.inputValue('[data-s="0"]'), "Fit the die");
  const [a, b] = await page.evaluate(() => S.lines[0].products);
  assert.notEqual(a.id, b.id);
  assert.equal(b.steps[0].img, a.steps[0].img, "photos copied");
  assert.equal(b.ap, undefined, "the copy is a new draft");
  // Editing the copy leaves the original alone; a second copy gets "(copy 2)".
  await page.fill('[data-s="0"]', "Changed");
  assert.equal(
    await page.evaluate(() => S.lines[0].products[0].steps[0].t),
    "Fit the die",
  );
  await page.evaluate(() => {
    V.p = S.lines[0].products[0].id;
    R();
  });
  await menuClick(page, "[data-a=dupP]");
  assert.deepEqual(
    await page.evaluate(() => S.lines[0].products.map((p) => p.name)),
    ["Widget A", "Widget A (copy 2)", "Widget A (copy)"],
  );
  // Machines too.
  await page.evaluate(() => {
    T = "m";
    MID = null;
    V = { l: null, p: null };
    R();
  });
  await typeNew(page, "Press 1");
  await page.click("[data-a=addM]");
  await menuClick(page, "[data-a=dupP]");
  assert.deepEqual(await page.evaluate(() => S.machines.map((m) => m.name)), [
    "Press 1",
    "Press 1 (copy)",
  ]);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("the ⋮ menu holds the page actions and closes when you tap elsewhere", async () => {
  const { ctx, page, errors } = await open();
  await setupCompany(page);
  await newProduct(page);
  assert.equal(
    await page.locator("[data-a=pdf]").count(),
    0,
    "no buttons on the page",
  );
  await page.click('[data-a=menu][data-m="t"]');
  const items = await page
    .locator(".kmenu > button, .kmenu > label")
    .allTextContents();
  assert.deepEqual(items, [
    "Download PDF",
    "Request approval",
    "Import approval file",
    "Duplicate",
    "Export this product",
    "Delete product",
  ]);
  assert.equal(
    await page.getAttribute('[data-a=menu][data-m="t"]', "aria-expanded"),
    "true",
  );
  // Ticking an option inside keeps it open; a tap outside closes it.
  await page.click(".kmenu [data-ps]");
  assert.equal(await page.locator(".kmenu").count(), 1);
  await page.click("[data-f=name]");
  assert.equal(await page.locator(".kmenu").count(), 0);
  // Escape closes it too.
  await page.click('[data-a=menu][data-m="t"]');
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(".kmenu").count(), 0);
  // Line page: Rename, Export, Delete.
  await page.click("[data-a=openL]");
  await page.click('[data-a=menu][data-m="t"]');
  assert.deepEqual(await page.locator(".kmenu > button").allTextContents(), [
    "Download all PDFs (ZIP)",
    "Rename line",
    "Export this line",
    "Delete this line",
  ]);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("cleaner pages: step menus, photo viewer, folding sections, badge, help, settings, tabs", async () => {
  const { ctx, page, errors } = await open(APP, { role: "admin" });
  await setupCompany(page);
  // Home: no storage or backup sections; they are in Settings.
  assert.equal(await page.locator("#stor").count(), 0);
  assert.equal(await page.locator("[data-a=goAp].opt").count(), 1);
  await openMenu(page, "user");
  assert.match(await page.textContent(".kmenu"), /Test User.*Admin/);
  await page.keyboard.press("Escape");
  await settings(page);
  await page.waitForSelector("#stor .m");
  // The user guide is linked from Settings and is in the repo.
  assert.equal(await page.locator('a[href="docs/user-guide.pdf"]').count(), 1);
  assert.ok(fs.statSync(path.join(ROOT, "docs/user-guide.pdf")).size > 100000);
  await page.click("[data-a=goX]");
  assert.equal(await page.locator("[data-a=xExport]").count(), 1);
  await page.click("[data-a=xtab][data-t=im]");
  assert.equal(await page.locator("[data-a=xExport]").count(), 0);
  assert.equal(await page.locator("input[type=file][multiple]").count(), 1);
  await page.click("[data-a=goHome]");
  await newProduct(page);
  // Badge: details only when tapped; ? opens the help.
  assert.equal(await page.locator("#apbox").textContent(), "");
  await page.click("#apbadge");
  assert.match(await page.textContent("#apbox"), /not approved yet/);
  await page.click("[data-a=help]");
  assert.equal(await page.locator('[data-help="item"][open]').count(), 1);
  // Step ⋮: move a step down.
  await page.fill('[data-s="0"]', "First");
  await page.click("[data-a=addS]");
  await page.fill('[data-s="1"]', "Second");
  await stepMenu(page, 0, "[data-a=dn]");
  assert.equal(await page.inputValue('[data-s="0"]'), "Second");
  // Photo viewer opens on tap and closes with Escape.
  await page.setInputFiles('[data-up="step"][data-i="0"]', PHOTO);
  await viewPhoto(page, 0, 0);
  assert.equal(await page.locator("#pv [data-a=mk]").count(), 1);
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#pv").count(), 0);
  // A folded section stays folded after a reload.
  await page.click("[data-sec=tools] > summary");
  await page.waitForFunction(() =>
    /"sec":\["tools"\]/.test(localStorage.getItem("sp-view")),
  ); // saved
  await page.waitForTimeout(300); // and not undone by a late event
  // Read the saved settings again and redraw (a full reload of a file://
  // page can lose very recent localStorage writes in Chromium).
  await page.evaluate(() => {
    SECS = new Set();
    loadView();
    R();
  });
  await page.waitForSelector("[data-sec=tools]");
  assert.equal(await page.locator("[data-sec=tools][open]").count(), 0);
  assert.equal(await page.locator("[data-sec=steps][open]").count(), 1);
  // "＋ New product" opens the name box; Cancel closes it.
  await page.click("[data-a=openL]");
  assert.equal(await page.locator("#nw").count(), 0);
  await page.click("[data-a=addOpen]");
  await page.click("[data-a=addCancel]");
  assert.equal(await page.locator("#nw").count(), 0);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("settings table, photo order, duplicate to a line, merge lines, check before printing, PDFs of a line", async () => {
  const { Zip } = require("../../js/zip.js");
  const { ctx, page, errors } = await open();
  const dialogs = [];
  page.on("dialog", (d) => dialogs.push(d.message()));
  await setupCompany(page);
  await newProduct(page);
  // Machine settings print as a table.
  await page.click("[data-a=addSet]");
  await page.fill('[data-set="0"][data-sk="n"]', "Mould temperature");
  await page.fill('[data-set="0"][data-sk="v"]', "220");
  await page.fill('[data-set="0"][data-sk="u"]', "C");
  // Photo order: move the second photo to the front.
  await page.setInputFiles('[data-up="step"][data-i="0"]', [PHOTO, PHOTO2]);
  await page.waitForSelector('[data-a=view][data-n="1"]');
  const [p1, p2] = await page.evaluate(() => [
    P().steps[0].img,
    P().steps[0].more[0],
  ]);
  await viewPhoto(page, 0, 1);
  await page.click("#pv [data-a=phMv][data-d='-1']");
  assert.deepEqual(
    await page.evaluate(() => [P().steps[0].img, P().steps[0].more[0]]),
    [p2, p1],
  );
  assert.equal(
    await page.locator("#pv [data-a=phMv][data-d='1']").count(),
    1,
    "viewer follows the photo",
  );
  await page.keyboard.press("Escape");
  // Check before printing: empty step text, no tools, no product photo.
  await page.fill("[data-f=by]", "Alex");
  const { bytes } = await download(page, () => menuClick(page, "[data-a=pdf]"));
  assert.match(
    await page.evaluate(() => ASKED.pop()),
    /look missing[\s\S]*There is no product photo[\s\S]*Step 1 has no text/,
  );
  const s = pdfText(bytes);
  assert.ok(
    s.includes("Machine settings") &&
      s.includes("Mould temperature") &&
      s.includes("220"),
  );
  // A second line; duplicate the product into it (same name there).
  await page.click("[data-a=openL]");
  await page.click("[data-a=home]");
  await typeNew(page, "Line 2");
  await page.click("[data-a=addL]");
  await page.click("[data-a=home]");
  await page.click("[data-a=openL] >> text=Line 1");
  await page.click("[data-a=openP]");
  await menuClick(page, "[data-a=pickLine][data-k=dup]");
  await page.click(".kmenu [data-a=dupP] >> text=Line 2");
  assert.match(await page.textContent(".hrow + *, #app"), /Line 2/);
  assert.deepEqual(
    await page.evaluate(() =>
      S.lines.map((l) => [l.name, l.products.map((p) => p.name)]),
    ),
    [
      ["Line 1", ["Widget A"]],
      ["Line 2", ["Widget A"]],
    ],
  );
  // Merge Line 2 into Line 1: the clash gets the old line's name.
  await page.click("[data-a=openL]");
  await menuClick(page, "[data-a=pickLine][data-k=merge]");
  await page.click(".kmenu [data-a=mergeL] >> text=Line 1");
  assert.deepEqual(
    await page.evaluate(() =>
      S.lines.map((l) => [l.name, l.products.map((p) => p.name)]),
    ),
    [["Line 1", ["Widget A", "Widget A (Line 2)"]]],
  );
  assert.match(await page.textContent("#toast"), /merged into "Line 1"/);
  // All PDFs of the line in one .zip.
  const zip = await download(page, () => menuClick(page, "[data-a=pdfLine]"));
  const today = await page.evaluate(() => dateStamp());
  assert.match(zip.name, /^Line 1 - PDFs - .*\.zip$/);
  const names = [
    ...(
      await Zip.read(
        zip.bytes.buffer.slice(
          zip.bytes.byteOffset,
          zip.bytes.byteOffset + zip.bytes.length,
        ),
      )
    ).keys(),
  ].sort();
  assert.deepEqual(
    names,
    [
      `Widget A (Line 2) - Rev 1 - ${today} - DRAFT.pdf`,
      `Widget A - Rev 1 - ${today} - DRAFT.pdf`,
    ].sort(),
  );
  assert.equal(
    await page.evaluate(() => S.log.length),
    3,
    "each PDF is in the print log",
  );
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("steps can be reordered by drag and drop", async () => {
  const { ctx, page, errors } = await open();
  await page.setViewportSize({ width: 1200, height: 2400 }); // all steps on screen
  await setupCompany(page);
  await newProduct(page);
  await page.fill('[data-s="0"]', "A");
  for (const [i, t] of [
    [1, "B"],
    [2, "C"],
  ]) {
    await page.click("[data-a=addS]");
    await page.fill(`[data-s="${i}"]`, t);
  }
  const texts = () => page.evaluate(() => P().steps.map((s) => s.t));
  // Step C onto the top half of step A: C, A, B.
  await page.dragAndDrop('[data-drag="2"]', '[data-box="0"]', {
    targetPosition: { x: 40, y: 8 },
  });
  assert.deepEqual(await texts(), ["C", "A", "B"]);
  assert.match(await page.textContent("#toast"), /Step 3 moved to position 1/);
  // Step 1 (C) onto the bottom half of the last step: A, B, C.
  const h = (await page.locator('[data-box="2"]').boundingBox()).height;
  await page.dragAndDrop('[data-drag="0"]', '[data-box="2"]', {
    targetPosition: { x: 40, y: h - 8 },
  });
  assert.deepEqual(await texts(), ["A", "B", "C"]);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("theme choice, app-styled questions and keyboard shortcuts", async () => {
  const { ctx, page, errors } = await open(APP, { role: "admin" });
  await setupCompany(page);
  // Theme: Dark is kept after a reload of the settings.
  await settings(page);
  await page.check('input[name="theme"][value="dark"]');
  assert.equal(await page.getAttribute("html", "data-theme"), "dark");
  await page.evaluate(() => {
    THEME = "auto";
    loadView();
  });
  assert.equal(await page.getAttribute("html", "data-theme"), "dark");
  await page.check('input[name="theme"][value="auto"]');
  assert.equal(await page.getAttribute("html", "data-theme"), null);
  await page.click("[data-a=goHome]");
  await newProduct(page);
  // Question box: Cancel (and Esc) keep the product; the red button deletes.
  await page.evaluate(() => (ASK_MANUAL = true));
  await menuClick(page, "[data-a=delP]");
  await page.waitForSelector("#ask");
  assert.match(await page.textContent("#ask"), /Delete this product\?/);
  assert.equal(
    await page.getAttribute('#ask [data-ask="1"]', "class"),
    "b dng",
  );
  await page.click('#ask [data-ask="0"]');
  assert.equal(await page.locator("#ask").count(), 0);
  await menuClick(page, "[data-a=delP]");
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#ask").count(), 0);
  assert.equal(await page.evaluate(() => S.lines[0].products.length), 1);
  await page.evaluate(() => (ASK_MANUAL = false));
  // Shortcuts: Ctrl+Enter adds a step after the one being edited.
  await page.fill('[data-s="0"]', "First");
  await page.click('[data-s="0"]');
  await page.keyboard.press("Control+Enter");
  assert.equal(await page.evaluate(() => P().steps.length), 2);
  assert.equal(
    await page.evaluate(() => document.activeElement.dataset.h),
    "1",
  );
  await page.keyboard.press("Control+s");
  assert.match(
    await page.textContent("#toast"),
    /saves your work automatically/,
  );
  await page.fill("[data-f=by]", "Alex");
  const { name } = await download(page, () => page.keyboard.press("Control+p"));
  assert.match(name, /^Widget A - Rev 1 - .* - DRAFT\.pdf$/);
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
  await stepMenu(page, 0, "[data-a=rmS]");
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
  await typeNew(page, "Press 3");
  await page.click("[data-a=addM]");
  await page.check('[data-ppe="helmet"]');
  await page.fill('[data-s="0"]', "Switch off the main power.");
  await page.fill("[data-f=by]", "Alex");
  const { bytes } = await download(page, () => menuClick(page, "[data-a=pdf]"));
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
  await a.page.waitForSelector('[data-a=view][data-k=step][data-i="0"]');
  await a.page.click("[data-a=openL]");
  await a.page.click("[data-a=home]");
  await a.page.click("[data-a=goHome]");
  await settings(a.page, "[data-a=goX]");
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
  const site = {};
  const server = http.createServer(async (req, res) => {
    // site.delay: answer slowly, like a slow network.
    if (site.delay) await new Promise((r) => setTimeout(r, site.delay).unref());
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
  return Object.assign(site, {
    url: `http://127.0.0.1:${server.address().port}/`,
    files,
    close: () => {
      server.closeAllConnections();
      server.close();
    },
  });
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
    await enterCode(page, "test code 1"); // case, spaces and dashes don't matter
    await page.waitForSelector("[data-co=name]");
    assert.match(await page.textContent("h1"), /Welcome/);
    await page.reload();
    await page.waitForSelector("[data-co=name]"); // remembered
    site.files["/js/access.js"] = list(["OTHER-CODE-2"]);
    await page.reload();
    await page.waitForSelector("#lockCode");
    assert.match(await page.textContent("#lock"), /no longer works/);
    await enterCode(page, "OTHER-CODE-2");
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
    const { bytes } = await download(page, () =>
      menuClick(page, "[data-a=pdf]"),
    );
    assert.ok(pdfText(bytes).includes("Hi-vis vest"));
    assert.deepEqual(errors, []);
    await ctx.close();
  } finally {
    site.close();
  }
});

test("on a slow network the app opens from the stored copy within seconds", async () => {
  const site = await serve();
  try {
    const { ctx, page, errors } = await open(site.url);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    site.delay = 30000; // every file now takes 30 seconds
    const t0 = Date.now();
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("h1", { timeout: 15000 });
    assert.match(await page.textContent("h1"), /Welcome/);
    assert.ok(Date.now() - t0 < 15000, `opened in ${Date.now() - t0} ms`);
    assert.deepEqual(errors, []);
    await ctx.close();
  } finally {
    site.close();
  }
});

test("a photo can be marked up with an arrow, a circle and numbers, and undone", async () => {
  const { ctx, page, errors } = await open();
  await setupCompany(page);
  await newProduct(page);
  await page.setInputFiles('[data-up="step"][data-i="0"]', PHOTO);
  await page.waitForSelector('[data-a=view][data-k="step"]');
  const before = await page.evaluate(() => P().steps[0].img);
  await viewPhoto(page, 0, 0);
  await page.click('#pv [data-a="mk"][data-k="step"]');
  await page.waitForSelector("#mkc");
  const box = await page.locator("#mkc").boundingBox();
  const at = (fx, fy) => [box.x + box.width * fx, box.y + box.height * fy];
  // arrow
  await page.mouse.move(...at(0.2, 0.2));
  await page.mouse.down();
  await page.mouse.move(...at(0.5, 0.5), { steps: 5 });
  await page.mouse.up();
  // circle in yellow
  await page.click('[data-mkt="circle"]');
  await page.click('[data-mkc="yellow"]');
  await page.mouse.move(...at(0.6, 0.6));
  await page.mouse.down();
  await page.mouse.move(...at(0.9, 0.9), { steps: 5 });
  await page.mouse.up();
  // two numbers, then remove the last one
  await page.click('[data-mkt="num"]');
  await page.mouse.click(...at(0.1, 0.8));
  await page.mouse.click(...at(0.3, 0.8));
  await page.click('[data-mkx="undo"]');
  assert.deepEqual(
    await page.evaluate(() =>
      MK.shapes.map((s) => s.t + (s.n || "") + ":" + s.c),
    ),
    ["arrow:red", "circle:yellow", "num1:yellow"],
  );
  await page.click('[data-mkx="save"]');
  await page.waitForSelector("#mk", { state: "detached" });
  const after = await page.evaluate(() => P().steps[0].img);
  assert.ok(after.startsWith("data:image/jpeg") && after != before);
  assert.match(await page.textContent("#toast"), /Photo marked up in step 1/);
  await page.click("#toast [data-undo]");
  assert.equal(await page.evaluate(() => P().steps[0].img), before);

  // Cancel leaves the photo as it was; gallery photos have the button too.
  await page.setInputFiles('[data-up="prod"]', PHOTO);
  await page.click('.th [data-a="mk"][data-k="prod"]');
  await page.waitForSelector("#mkc");
  await page.keyboard.press("Escape");
  await page.waitForSelector("#mk", { state: "detached" });
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("each PDF is listed in the print log, which filters and downloads as CSV", async () => {
  const { ctx, page, errors } = await open(APP, { role: "admin" });
  await setupCompany(page);
  await newProduct(page);
  await page.fill("[data-f=code]", "WA-1");
  await page.fill("[data-f=by]", "Alex");
  await download(page, () => menuClick(page, "[data-a=pdf]"));
  await page.fill("[data-f=rev]", "2");
  await download(page, () => menuClick(page, "[data-a=pdf]"));
  await page.click("[data-a=openL]");
  await page.click("[data-a=home]");
  await page.click("[data-a=goHome]");
  await settings(page);
  assert.match(await page.textContent("#app"), /the print log \(2 PDFs\)/);
  await page.click("[data-a=goLog]");
  await page.click("[data-a=ltab][data-t=print]");
  const rows = await page.$$eval(".log tbody tr", (r) =>
    r.map((x) =>
      [...x.cells].map((c) => c.innerText.replace(/\s+/g, " ").trim()),
    ),
  );
  assert.equal(rows.length, 2);
  const ref = "Ref " + ADMIN.slice(0, 6).toUpperCase();
  assert.deepEqual(rows[0].slice(1), [
    "Widget A Product · Line 1",
    "WA-1",
    "2",
    "Draft",
    "Press Shop",
    "Test User · Admin 1 · " + ref,
    "1",
  ]);
  assert.equal(rows[1][3], "1");
  await page.fill("[data-lf]", "nothing like this");
  assert.equal(await page.locator(".log tbody tr").count(), 0);
  await page.fill("[data-lf]", "");
  const csv = await download(page, () => page.click("[data-a=logCsv]"));
  const text = csv.bytes.toString("utf8");
  assert.match(csv.name, /^print-log-\d{4}-\d{2}-\d{2}\.csv$/);
  assert.match(text, /"Date and time","Type","Name"/);
  assert.match(
    text,
    /"Product","Widget A","WA-1","2","Draft","Line 1","Press Shop","Test User","Admin 1"/,
  );
  await page.click("[data-a=logClear]");
  assert.match(await page.textContent("#app"), /No PDFs made yet/);
  await page.click("#toast [data-undo]");
  assert.equal(await page.locator(".log tbody tr").count(), 2);
  assert.deepEqual(errors, []);
  await ctx.close();
});

// Approvals use a test approver whose code is known (served in place of js/approvers.js).
const stubMail = (page) =>
  page.evaluate(() => {
    window.MAILS = [];
    window.openMail = (to, subject, body) => {
      APMAIL = { to, subject, body };
      MAILS.push({ to, subject, body });
    };
  });
const saveTo = (dl) => {
  const f = path.join(
    fs.mkdtempSync(path.join(require("os").tmpdir(), "sp-")),
    dl.name,
  );
  fs.writeFileSync(f, dl.bytes);
  return f;
};

test("approval: request by email, sign with the approver code, import, and draft again after a change", async () => {
  const CODE = "TEST-APPR-0001-CODE";
  const { pub } = await apKeys(CODE);
  const site = await serve({
    "/js/approvers.js": `const APPROVERS = [["Test Approver", "${pub}"]];`,
  });
  try {
    // Author: a draft prints with DRAFT.
    const A = await open(site.url);
    await setupCompany(A.page);
    await newProduct(A.page);
    await A.page.fill('[data-s="0"]', "Tighten the clamps.");
    await A.page.fill("[data-f=by]", "Alex");
    await A.page.waitForSelector("#apbadge .badge.dr");
    let s = pdfText(
      (await download(A.page, () => menuClick(A.page, "[data-a=pdf]"))).bytes,
    );
    assert.ok(s.includes("(DRAFT)") && s.includes("Not approved: draft"));

    // Request approval: a .zip is saved and an email opened.
    await stubMail(A.page);
    await menuClick(A.page, "[data-a=apReq]");
    await A.page.selectOption('[data-ap="to"]', "Test Approver");
    await A.page.fill('[data-ap="tomail"]', "boss@example.com");
    await A.page.fill('[data-ap="mymail"]', "alex@example.com");
    const req = await download(A.page, () => A.page.click("[data-a=apSend]"));
    assert.equal(req.name, "Approval request - Widget A - rev 1.zip");
    const mail = (await A.page.evaluate(() => MAILS))[0];
    assert.equal(mail.to, "boss@example.com");
    assert.equal(mail.subject, "Approval request: Widget A rev 1");
    assert.match(
      await A.page.textContent("#apbox"),
      /Waiting for approval.*Test Approver/,
    );
    assert.match(await A.page.textContent(".card, #app"), /Widget A/);

    // Approver: opens the request, reviews, signs.
    // Approver: logs in with the approver code and lands on Approvals.
    const B = await open(site.url, { access: false });
    await enterCode(B.page, CODE.toLowerCase(), "Sam Lee");
    await B.page.waitForSelector("[data-apreq]", { state: "attached" });
    await stubMail(B.page);
    await B.page.setInputFiles("[data-apreq]", saveTo(req));
    await B.page.waitForSelector(".apform h3");
    assert.match(
      await B.page.textContent(".apform"),
      /Requested by Test User \(alex@example.com\)/,
    );
    const rv = await download(B.page, () => B.page.click("[data-a=apPdf]"));
    assert.ok(rv.name.startsWith("REVIEW - Widget A - Rev 1 - "), rv.name);
    assert.ok(pdfText(rv.bytes).includes("FOR REVIEW"));
    // Signed with the login code: no code box. The name is required.
    assert.equal(await B.page.locator("#apcode").count(), 0);
    assert.equal(
      await B.page.inputValue("[data-apn]"),
      "Sam Lee",
      "name from the login",
    );

    // Rejecting needs a comment; the author sees it.
    await B.page.check('input[name="apdec"][value="rejected"]');
    await B.page.click("[data-a=apSign]");
    await B.page.waitForSelector("p.err");
    assert.match(await B.page.textContent("p.err"), /Say what must change/);
    await B.page.fill("[data-apc]", "Add the torque for the second clamp.");
    const no = await download(B.page, () => B.page.click("[data-a=apSign]"));
    assert.equal(no.name, "Approval - Widget A - rev 1 - rejected.json");
    assert.equal(
      (await B.page.evaluate(() => MAILS))[0].to,
      "alex@example.com",
    );
    await openMenu(A.page);
    await A.page.setInputFiles("[data-apfile]", saveTo(no));
    await A.page.waitForSelector("#apbadge .badge.no");
    assert.match(
      await A.page.textContent("#apbox"),
      /Add the torque for the second clamp/,
    );

    // After a reload the approver is still logged in, but must type the code
    // again to sign (it is never stored); another code is refused.
    await B.page.reload();
    await stubMail(B.page);
    await B.page.setInputFiles("[data-apreq]", saveTo(req));
    await B.page.waitForSelector("[data-a=apSign]");
    assert.equal(await B.page.inputValue("[data-apn]"), "Sam Lee");
    await B.page.fill("[data-apc]", "Looks good.");
    await B.page.fill("#apcode", "WRONG-CODE-1234");
    await B.page.click("[data-a=apSign]");
    await B.page.waitForSelector("p.err");
    assert.match(
      await B.page.textContent("p.err"),
      /not the approver code you logged in with/,
    );
    await B.page.fill("[data-apc]", "Looks good.");
    await B.page.fill("#apcode", CODE);
    const ok = await download(B.page, () => B.page.click("[data-a=apSign]"));
    assert.equal(ok.name, "Approval - Widget A - rev 1 - approved.json");

    // A changed copy of the file is refused.
    const bad = JSON.parse(ok.bytes.toString("utf8"));
    bad.payload.comment = "Changed";
    const badFile = path.join(path.dirname(saveTo(ok)), "bad.json");
    fs.writeFileSync(badFile, JSON.stringify(bad));
    await openMenu(A.page);
    await A.page.setInputFiles("[data-apfile]", badFile);
    await A.page.waitForSelector("#apbox p.err");
    assert.match(
      await A.page.textContent("#apbox"),
      /changed since it was signed/,
    );

    // Author imports the approval: Approved, PDF without DRAFT.
    await openMenu(A.page);
    await A.page.setInputFiles("[data-apfile]", saveTo(ok));
    await A.page.waitForSelector("#apbadge .badge.ok");
    assert.match(
      await A.page.textContent("#apbox"),
      /Approved by Sam Lee \(Test Approver\).*Looks good/,
    );
    s = pdfText(
      (await download(A.page, () => menuClick(A.page, "[data-a=pdf]"))).bytes,
    );
    assert.ok(!s.includes("(DRAFT)") && !s.includes("Not approved"));
    assert.ok(
      s.includes("(Sam Lee)") &&
        !s.includes("Approver code") &&
        s.includes("(Approver ref " + pub.slice(0, 6).toUpperCase() + ")") &&
        s.includes("approver ref " + pub.slice(0, 6).toUpperCase() + ")") &&
        s.includes("digital signature checked"),
    );

    // Any change makes it a draft again; undoing the change brings it back.
    await A.page.fill('[data-s="0"]', "Tighten the clamps to 30 Nm.");
    await A.page.waitForSelector("#apbadge .badge.dr");
    assert.match(
      await A.page.textContent("#apbox"),
      /Changed after it was approved/,
    );
    s = pdfText(
      (await download(A.page, () => menuClick(A.page, "[data-a=pdf]"))).bytes,
    );
    assert.ok(s.includes("(DRAFT)"));
    await A.page.fill('[data-s="0"]', "Tighten the clamps.");
    await A.page.waitForSelector("#apbadge .badge.ok");

    assert.deepEqual(A.errors, []);
    assert.deepEqual(B.errors, []);
    await A.ctx.close();
    await B.ctx.close();
  } finally {
    site.close();
  }
});

test("each code opens its own pages, and Log out lets the next person log in", async () => {
  const AUTHOR = "TEST-AUTHOR-0001",
    ADMINC = "TEST-ADMIN-0001",
    APPR = "TEST-APPROVER-0001",
    { pub } = await apKeys(APPR);
  const site = await serve({
    "/js/access.js": `const ACCESS_CODES = [["Test Author", "${codeHash(AUTHOR)}"]];`,
    "/js/admins.js": `const ADMIN_CODES = [["Test Admin", "${codeHash(ADMINC)}"]];`,
    "/js/approvers.js": `const APPROVERS = [["Test Approver", "${pub}"]];`,
  });
  const login = async (page, code) => {
    await enterCode(page, code);
    await page.waitForSelector(".ubar");
  };
  const logout = async (page) => {
    await logoutClick(page);
    await page.waitForSelector("#lockCode");
  };
  try {
    const { ctx, page, errors } = await open(site.url, { access: false });
    // Author: products and machines, no print log.
    await login(page, AUTHOR);
    assert.match(
      await page.textContent(".ubar"),
      /Test User · Author \(Test Author\)/,
    );
    await setupCompany(page);
    assert.ok(await page.isVisible("[data-a=tab][data-t=p]"));
    assert.equal(await page.locator("[data-a=goLog]").count(), 0);
    assert.equal(await page.locator("[data-a=clearAll]").count(), 0);
    await page.evaluate(() => {
      T = "log";
      R();
    });
    assert.doesNotMatch(await page.textContent("h1"), /Print log/);
    await page.click("[data-a=goAp]");
    assert.equal(
      await page.locator("[data-apreq]").count(),
      0,
      "authors do not review",
    );
    assert.equal(await page.locator("[data-apfile]").count(), 1);
    await page.reload();
    await page.waitForSelector(".ubar"); // still logged in
    await logout(page);

    // Admin: same data, plus the print log.
    await login(page, ADMINC);
    assert.match(
      await page.textContent(".ubar"),
      /Test User · Admin \(Test Admin\)/,
    );
    assert.match(await page.textContent("#app"), /ACME Ltd/);
    await settings(page, "[data-a=goLog]");
    assert.match(await page.textContent("h1"), /Logs/);
    await logout(page);

    // Approver: only the Approvals page.
    await login(page, APPR);
    assert.match(
      await page.textContent(".ubar"),
      /Test User · Approver \(Test Approver\)/,
    );
    assert.match(await page.textContent("h1"), /Approvals/);
    assert.equal(await page.locator("[data-a=goHome]").count(), 0);
    assert.equal(await page.locator("[data-apreq]").count(), 1);
    await page.evaluate(() => {
      T = "h";
      R();
    });
    assert.match(await page.textContent("h1"), /Approvals/);
    await page.reload();
    await page.waitForSelector("[data-apreq]", { state: "attached" });
    await logout(page);

    // A login from before names were asked for: the name is asked once.
    await page.evaluate(
      (h) => localStorage.setItem("sp-access", h),
      codeHash(AUTHOR),
    );
    await page.reload();
    await page.waitForSelector("#lockName");
    await page.fill("#lockName", "Old Login");
    await page.click("#lock button");
    await page.waitForSelector(".ubar");
    assert.match(await page.textContent(".ubar"), /Old Login · Author/);
    await logout(page);
    assert.deepEqual(errors, []);
    await ctx.close();
  } finally {
    site.close();
  }
});

test("an unused login ends by itself, with a warning first", async () => {
  const AUTHOR = "TEST-AUTHOR-0002";
  const site = await serve({
    "/js/access.js": `const ACCESS_CODES = [["Test Author", "${codeHash(AUTHOR)}"]];`,
  });
  try {
    const { ctx, page, errors } = await open(site.url, { access: false });
    const login = async () => {
      await enterCode(page, AUTHOR);
      await page.waitForSelector(".ubar");
    };
    await login();
    // Short timeout for the test (normally 30 minutes).
    await page.evaluate(() => {
      IDLE_MS = 4000;
      clearInterval(idleTimer);
      idleTimer = null;
      startIdleWatch();
    });
    await page.waitForSelector("#idlewarn");
    assert.match(
      await page.textContent("#idlewarn"),
      /logged out in less than a minute/,
    );
    await page.click("#idlewarn [data-stay]");
    assert.equal(await page.locator("#idlewarn").count(), 0);
    assert.ok(await page.isVisible(".ubar"), "still logged in");
    await page.waitForSelector("#lockCode", { timeout: 15000 });
    assert.match(
      await page.textContent("#lock"),
      /logged out after .* without activity/,
    );

    // A login left for longer than 30 minutes (browser closed) has ended too.
    await login();
    await page.evaluate(() =>
      localStorage.setItem("sp-active", String(Date.now() - 31 * 60 * 1000)),
    );
    await page.reload();
    await page.waitForSelector("#lockCode");
    assert.match(
      await page.textContent("#lock"),
      /logged out after 30 minutes/,
    );
    // A recent login is kept.
    await login();
    await page.reload();
    await page.waitForSelector(".ubar");
    // "This is my own device": no automatic log-out, even after a long time.
    await logoutClick(page);
    await page.fill("#lockCode", AUTHOR);
    await page.click("#lock button");
    await page.waitForSelector("#lockOwn");
    await page.check("#lockOwn");
    await page.click("#lock button");
    await page.waitForSelector(".ubar");
    await page.evaluate(() =>
      localStorage.setItem(
        "sp-active",
        String(Date.now() - 24 * 60 * 60 * 1000),
      ),
    );
    await page.reload();
    await page.waitForSelector(".ubar");
    assert.equal(await page.evaluate(() => idleTimer), null, "no idle watch");
    assert.deepEqual(errors, []);
    await ctx.close();
  } finally {
    site.close();
  }
});

test("admins see activity, print log and code usage; authors' names fill in Prepared by", async () => {
  const AUTHOR = "TEST-AUTHOR-0003",
    ADMINC = "TEST-ADMIN-0003";
  const site = await serve({
    "/js/access.js": `const ACCESS_CODES = [["Code A", "${codeHash(AUTHOR)}"], ["Code B", "${codeHash("TEST-UNUSED-1")}"]];`,
    "/js/admins.js": `const ADMIN_CODES = [["Admin X", "${codeHash(ADMINC)}"]];`,
    "/js/approvers.js": "const APPROVERS = [];",
  });
  try {
    const { ctx, page, errors } = await open(site.url, { access: false });
    // A failed login, then the author works.
    await page.fill("#lockCode", "NOT-A-CODE-99");
    await page.click("#lock button");
    await page.waitForSelector("#lockErr:not(:empty)");
    await enterCode(page, AUTHOR, "Alex Kim");
    await setupCompany(page);
    await newProduct(page);
    assert.equal(
      await page.inputValue("[data-f=by]"),
      "Alex Kim",
      "Prepared by from the login name",
    );
    await page.fill('[data-s="0"]', "Tighten the clamps.");
    await page.fill("[data-f=rev]", "2");
    await page.check('[data-ppe="gloves"]');
    await download(page, () => menuClick(page, "[data-a=pdf]"));
    await page.fill('[data-s="0"]', "Tighten the clamps to 25 Nm.");
    await page.click("[data-a=openL]"); // leave the product: the edit is recorded
    await page.click("[data-a=home]");
    await page.click("[data-a=goHome]");
    assert.equal(
      await page.locator("[data-a=goLog]").count(),
      0,
      "no logs for authors",
    );
    await download(page, () => page.click("[data-a=bk]"));
    await page.click("[data-a=tab][data-t=m]");
    await typeNew(page, "Press 3");
    await page.click("[data-a=addM]");
    await menuClick(page, "[data-a=delP]");
    await logoutClick(page);

    // Admin: Logs page.
    await enterCode(page, ADMINC, "Pat Admin");
    await settings(page, "[data-a=goLog]");
    assert.match(await page.textContent("h1"), /Logs/);
    const rows = await page.$$eval(".log tbody tr", (r) =>
      r.map((x) =>
        [...x.cells]
          .map((c) => c.innerText.trim())
          .slice(1)
          .join(" | "),
      ),
    );
    const has = (re) =>
      assert.ok(
        rows.some((x) => re.test(x)),
        `activity should have ${re}\n${rows.join("\n")}`,
      );
    has(/^Login \| Logged in \| Pat Admin \(Admin X\)$/);
    has(/^Login \| Logged out \| Alex Kim \(Code A\)$/);
    has(/^Login \| Failed login: wrong code \| –$/);
    has(/^Login \| Logged in \| Alex Kim \(Code A\)$/);
    has(/^Change \| Created product "Widget A" \(Line 1\) \| Alex Kim/);
    has(
      /^Change \| Edited product "Widget A" \(Line 1\): Revision "1" → "2"; Safety equipment; Step 1 changed \| Alex Kim/,
    );
    has(
      /^Change \| Edited product "Widget A" \(Line 1\): Step 1 changed \| Alex Kim/,
    );
    has(
      /^Export \/ import \| Exported "setup-procedures-backup-.*\.zip" \| Alex Kim/,
    );
    has(/^Deletion \| Deleted machine "Press 3", rev 1 \| Alex Kim/);
    has(/^Change \| Company details changed|^Change \| Line "Line 1" created/);
    // Filter by type.
    await page.selectOption("[data-at]", "delete");
    assert.equal(await page.locator(".log tbody tr").count(), 1);
    const csv = await download(page, () => page.click("[data-a=actCsv]"));
    assert.match(csv.name, /^activity-log-\d{4}-\d{2}-\d{2}\.csv$/);
    assert.match(
      csv.bytes.toString("utf8"),
      /"Deletion","Deleted machine ""Press 3"", rev 1","Alex Kim","Code A","Author"/,
    );

    // Print log tab: who made the PDF.
    await page.click("[data-a=ltab][data-t=print]");
    assert.match(await page.textContent(".log"), /Alex Kim · Code A · Ref/);
    // Code usage tab.
    await page.click("[data-a=ltab][data-t=codes]");
    const usage = await page.$$eval(".log tbody tr", (r) =>
      r.map((x) => [...x.cells].map((c) => c.innerText.trim())),
    );
    const a = usage.find((x) => x[0] == "Code A"),
      b = usage.find((x) => x[0] == "Code B");
    assert.deepEqual(
      [a[1], a[2], a[4], a[6]],
      ["Author", "1", "1", "Alex Kim"],
    );
    assert.deepEqual([b[2], b[4]], ["0", "0"]);
    assert.match(
      await page.textContent("#app"),
      /1 code has not been used here/,
    );
    assert.deepEqual(errors, []);
    await ctx.close();
  } finally {
    site.close();
  }
});

test("undo warns before also undoing later changes", async () => {
  const { ctx, page, errors } = await open();
  await setupCompany(page);
  await newProduct(page);
  await page.click("[data-a=addTool]");
  await page.keyboard.type("Wrench");
  await page.click('[data-a=rmTool][data-i="0"]');
  // Undo straight away: no question.
  await page.evaluate(() => (ASK_ANSWER = "0")); // Cancel
  const asked = () => page.evaluate(() => ASKED.length);
  await page.click("#toast [data-undo]");
  assert.equal(await asked(), 0);
  assert.equal(await page.inputValue('[data-tool="0"][data-tk="n"]'), "Wrench");
  // Remove again, then keep working: Ctrl+Z asks, and Cancel keeps the work.
  await page.click('[data-a=rmTool][data-i="0"]');
  await page.fill('[data-s="0"]', "Later work");
  await page.click("h1");
  await page.keyboard.press("Control+z");
  await page.waitForFunction(
    () => ASKED.length == 1 && !document.querySelector("#ask"),
  );
  assert.equal(await asked(), 1);
  assert.equal(await page.inputValue('[data-s="0"]'), "Later work");
  assert.equal(await page.locator("[data-tool]").count(), 0);
  assert.deepEqual(errors, []);
  await ctx.close();
});
