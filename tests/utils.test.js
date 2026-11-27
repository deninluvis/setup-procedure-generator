const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  id,
  esc,
  parseBackup,
  toMinutes,
  fmtTime,
  normCo,
  deptOf,
  deptName,
  fmtBytes,
} = require("../js/utils.js");

test("esc escapes HTML special characters", () => {
  assert.equal(
    esc('<a href="x">&</a>'),
    "&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;",
  );
  assert.equal(esc(null), "");
  assert.equal(esc(undefined), "");
  assert.equal(esc(42), "42");
});

test("id returns short random strings", () => {
  const a = id();
  assert.match(a, /^[a-z0-9]{1,7}$/);
  assert.notEqual(a, id());
});

test("toMinutes combines hours and minutes, null when both empty", () => {
  assert.equal(toMinutes("1", "30"), 90);
  assert.equal(toMinutes("", "45"), 45);
  assert.equal(toMinutes("2", ""), 120);
  assert.equal(toMinutes("0", "90"), 90);
  assert.equal(toMinutes("", ""), null);
  assert.equal(toMinutes(undefined, undefined), null);
});

test("fmtTime shows hours and minutes", () => {
  assert.equal(fmtTime(90), "1 h 30 min");
  assert.equal(fmtTime(45), "0 h 45 min");
  assert.equal(fmtTime(125), "2 h 5 min");
  assert.equal(fmtTime(null), "");
});

test("parseBackup accepts valid backups and rejects others", () => {
  const noCo = { name: "", depts: [] };
  assert.deepEqual(parseBackup({ lines: [] }), {
    lines: [],
    machines: [],
    co: noCo,
  });
  assert.deepEqual(parseBackup({ lines: [1], machines: [2] }), {
    lines: [1],
    machines: [2],
    co: noCo,
  });
  assert.deepEqual(parseBackup({ lines: [], machines: "bad" }), {
    lines: [],
    machines: [],
    co: noCo,
  });
  assert.deepEqual(
    parseBackup({
      lines: [],
      co: { name: "ACME", depts: [{ id: "a", name: "Assembly" }], done: true },
    }).co,
    { name: "ACME", depts: [{ id: "a", name: "Assembly" }], done: true },
  );
  assert.equal(
    parseBackup({ lines: [], co: { name: " ", done: true } }).co.done,
    undefined,
  );
  assert.equal(parseBackup(null), null);
  assert.equal(parseBackup({}), null);
  assert.equal(parseBackup({ lines: "nope" }), null);
  assert.equal(
    parseBackup({ lines: [], logo: "data:image/png;base64,AAA" }).logo,
    "data:image/png;base64,AAA",
  );
  assert.equal(
    "logo" in parseBackup({ lines: [], logo: "javascript:alert(1)" }),
    false,
  );
});

test("normCo upgrades a single old department and cleans the list", () => {
  assert.deepEqual(normCo({ name: "ACME", dept: "Assembly", done: true }), {
    name: "ACME",
    depts: [{ id: "d1", name: "Assembly" }],
    done: true,
  });
  assert.deepEqual(normCo({ name: "ACME", dept: "  " }), {
    name: "ACME",
    depts: [],
  });
  assert.deepEqual(
    normCo({ name: "X", depts: [null, "bad", { id: "p", name: "Press" }] })
      .depts,
    [{ id: "p", name: "Press" }],
  );
  assert.equal(
    normCo({ depts: [{ name: "No id" }] }).depts[0].id.length > 0,
    true,
  );
  assert.deepEqual(normCo(undefined), { name: "", depts: [] });
});

test("deptOf and deptName pick the right department", () => {
  const co = {
    depts: [
      { id: "a", name: "Assembly" },
      { id: "p", name: "Press" },
    ],
  };
  assert.equal(deptOf({}, co), "a"); // older items use the first department
  assert.equal(deptOf({ dept: "p" }, co), "p");
  assert.equal(deptOf({ dept: "" }, co), "");
  assert.equal(deptOf({}, { depts: [] }), "");
  assert.equal(deptName("p", co), "Press");
  assert.equal(deptName("gone", co), "");
  assert.equal(deptName("", co), "");
});

test("fmtBytes shows KB, MB and GB", () => {
  assert.equal(fmtBytes(0), "1 KB");
  assert.equal(fmtBytes(512 * 1024), "512 KB");
  assert.equal(fmtBytes(12.34 * 1024 * 1024), "12.3 MB");
  assert.equal(fmtBytes(1.5 * 1024 ** 3), "1.5 GB");
});

const {
  imgRefs,
  similarPath,
  dateStamp,
  safeName,
  imgExt,
  planBackup,
  planItems,
  itemPacks,
  deptItems,
  lineItems,
  imgPaths,
  restoreImgs,
  addItem,
  daysSince,
  agoText,
  backupDue,
} = require("../js/utils.js");
const JPG = "data:image/jpeg;base64,AAAA",
  JPG2 = "data:image/jpeg;base64,BBBB",
  PNG = "data:image/png;base64,CCCC";
const sample = () => ({
  co: { name: "ACME", depts: [{ id: "a", name: "Assembly" }], done: true },
  logo: PNG,
  lines: [
    {
      id: "l1",
      name: "Line 1",
      products: [
        {
          id: "p1",
          name: "Widget A",
          dept: "a",
          prod: [JPG],
          pack: [JPG2],
          steps: [
            { t: "one", img: "" },
            { t: "two", img: JPG },
          ],
        },
        {
          id: "p2",
          name: "Widget A",
          prod: [],
          pack: [],
          steps: [{ t: "x", img: JPG2 }],
        },
      ],
    },
  ],
  machines: [
    { id: "m1", name: "Press: 3/4", prod: [], pack: [JPG2], steps: [] },
  ],
});

test("dateStamp, safeName and imgExt", () => {
  assert.equal(dateStamp(new Date(2026, 0, 5)), "2026-01-05");
  assert.equal(safeName("Press: 3/4*  ", "X"), "Press 3 4");
  assert.equal(safeName(" ..", "Fallback"), "Fallback");
  assert.equal(imgExt(JPG), "jpg");
  assert.equal(imgExt(PNG), "png");
});

test("planBackup gives readable unique paths and stores each image once", () => {
  const { data, files } = planBackup(sample());
  assert.equal(data.format, "setup-procedures-backup");
  assert.equal(data.logo, "logo.png");
  const [a, b] = data.lines[0].products;
  assert.deepEqual(a.prod, ["photos/Line 1/Widget A/product-1.jpg"]);
  assert.deepEqual(a.pack, ["photos/Line 1/Widget A/packaging-1.jpg"]);
  assert.equal(a.steps[0].img, "");
  assert.equal(a.steps[1].img, "photos/Line 1/Widget A/product-1.jpg"); // same image reused
  assert.equal(b.steps[0].img, "photos/Line 1/Widget A/packaging-1.jpg");
  assert.deepEqual(data.machines[0].pack, [
    "photos/Line 1/Widget A/packaging-1.jpg",
  ]);
  assert.deepEqual(files.map((f) => f[0]).sort(), [
    "logo.png",
    "photos/Line 1/Widget A/packaging-1.jpg",
    "photos/Line 1/Widget A/product-1.jpg",
  ]);
});

test("duplicate names get separate folders", () => {
  const S = sample();
  S.lines[0].products[1].prod = ["data:image/jpeg;base64,DDDD"];
  const { data } = planBackup(S);
  assert.deepEqual(data.lines[0].products[1].prod, [
    "photos/Line 1/Widget A (2)/product-1.jpg",
  ]);
});

test("backup round trip: paths back to images, missing ones counted", () => {
  const S = sample(),
    { data, files } = planBackup(S);
  const json = JSON.parse(JSON.stringify(data));
  assert.equal(imgPaths(json).size, 3);
  const all = restoreImgs(json, new Map(files));
  assert.equal(all.missing, 0);
  assert.deepEqual(all.data.lines, S.lines);
  assert.deepEqual(all.data.machines, S.machines);
  assert.equal(all.data.logo, PNG);
  const some = restoreImgs(
    json,
    new Map(files.filter(([p]) => p != "logo.png")),
  );
  assert.equal(some.missing, 1);
  assert.equal("logo" in some.data, false);
});

test("planItems and restore for several items", () => {
  const S = sample();
  const list = [
    { p: S.machines[0], kind: "machine", line: "", dept: "Assembly" },
    {
      p: S.lines[0].products[0],
      kind: "product",
      line: "Line 1",
      dept: "Assembly",
    },
  ];
  const { data, files } = planItems(list);
  assert.equal(data.format, "setup-procedures-items");
  assert.deepEqual(data.items[0].item.pack, [
    "photos/Machines/Press 3 4/panel-1.jpg",
  ]);
  assert.deepEqual(data.items[1].item.prod, [
    "photos/Line 1/Widget A/product-1.jpg",
  ]);
  assert.equal(data.items[1].line, "Line 1");
  const back = restoreImgs(JSON.parse(JSON.stringify(data)), new Map(files));
  assert.equal(back.missing, 0);
  assert.deepEqual(
    back.data.items.map((x) => x.item),
    [S.machines[0], S.lines[0].products[0]],
  );
  assert.deepEqual(
    itemPacks(back.data).map((x) => x.kind),
    ["machine", "product"],
  );
});

test("itemPacks reads the older single-item format and rejects backups", () => {
  const old = {
    format: "setup-procedures-item",
    kind: "machine",
    item: { name: "M" },
  };
  assert.deepEqual(itemPacks(old), [{ ...old, kind: "machine" }]);
  const r = restoreImgs(
    {
      ...old,
      item: {
        name: "M",
        prod: ["photos/M/machine-1.jpg"],
        pack: [],
        steps: [],
      },
    },
    new Map([["photos/M/machine-1.jpg", JPG]]),
  );
  assert.deepEqual(r.data.item.prod, [JPG]);
  assert.equal(itemPacks({ lines: [] }), null);
  assert.equal(
    itemPacks({ format: "setup-procedures-items", items: [] }),
    null,
  );
  assert.equal(itemPacks(null), null);
});

test("deptItems and lineItems pick the right products and machines", () => {
  const S = sample();
  S.machines[0].dept = "a";
  // p1 has dept 'a'; p2 has no dept field, so it uses the first department ('a') too
  assert.deepEqual(
    deptItems(S, "a").map((x) => [x.kind, x.p.id, x.line, x.dept]),
    [
      ["product", "p1", "Line 1", "Assembly"],
      ["product", "p2", "Line 1", "Assembly"],
      ["machine", "m1", "", "Assembly"],
    ],
  );
  S.lines[0].products[1].dept = "";
  assert.equal(deptItems(S, "a").length, 2);
  assert.deepEqual(
    lineItems(S, "l1").map((x) => x.p.id),
    ["p1", "p2"],
  );
  assert.deepEqual(lineItems(S, "nope"), []);
});

test("backup reminder after 7 days, only when there is something to lose", () => {
  const now = new Date(2026, 10, 13, 9).getTime(),
    day = 864e5;
  assert.equal(daysSince(new Date(2026, 10, 12, 23).getTime(), now), 1);
  assert.equal(agoText(null, now), "never");
  assert.equal(agoText(now - 3600e3, now), "today");
  assert.equal(agoText(now - day, now), "yesterday");
  assert.equal(agoText(now - 9 * day, now), "9 days ago");
  const S = sample();
  assert.equal(backupDue(S, now), true); // never backed up
  S.lastBackup = now - 6 * day;
  assert.equal(backupDue(S, now), false);
  S.lastBackup = now - 7 * day;
  assert.equal(backupDue(S, now), true);
  assert.equal(
    backupDue({ lines: [{ products: [] }], machines: [] }, now),
    false,
  ); // nothing yet
});

test("addItem places products by line and department name", () => {
  const S = sample();
  const pk = {
    kind: "product",
    line: "line 1",
    dept: "Painting",
    item: { id: "x", name: "Gadget", prod: [], pack: [], steps: [] },
  };
  const r = addItem(S, pk, () => assert.fail("no clash expected"));
  assert.equal(r.lineId, "l1");
  assert.notEqual(r.item.id, "x");
  assert.equal(S.lines[0].products.length, 3);
  assert.equal(S.co.depts[1].name, "Painting"); // new department created
  assert.equal(r.item.dept, S.co.depts[1].id);
  const r2 = addItem(
    S,
    { ...pk, line: "New line", dept: "assembly" },
    () => false,
  );
  assert.equal(S.lines[1].name, "New line");
  assert.equal(r2.item.dept, "a"); // matched existing department, any case
});

test("addItem with a name clash replaces or keeps both", () => {
  const S = sample();
  const pk = {
    kind: "machine",
    item: { name: "press: 3/4", prod: [], pack: [], steps: [] },
  };
  const kept = addItem(S, pk, () => false);
  assert.equal(S.machines.length, 2);
  assert.equal(kept.item.name, "press: 3/4 (imported)");
  assert.equal(
    addItem(S, pk, () => false).item.name,
    "press: 3/4 (imported 2)",
  );
  S.machines.pop();
  const rep = addItem(S, pk, (name, where) => where == "Machines");
  assert.equal(rep.replaced, true);
  assert.equal(S.machines.length, 2);
  assert.equal(S.machines[0].id, "m1"); // keeps its place and id
  assert.equal(S.machines[0].name, "press: 3/4");
});

test("imgRefs says where every photo belongs", () => {
  const { data } = planBackup(sample());
  const refs = imgRefs(JSON.parse(JSON.stringify(data)));
  assert.deepEqual(
    refs.map((r) => [r.item, r.kind, r.line, r.what]),
    [
      ["Widget A", "product", "Line 1", "Product photo 1"],
      ["Widget A", "product", "Line 1", "Packaging photo 1"],
      ["Widget A", "product", "Line 1", "Step 2 photo"],
      ["Widget A", "product", "Line 1", "Step 1 photo"],
      ["Press: 3/4", "machine", "", "Control panel photo 1"],
      ["Company logo", "logo", "", "Logo"],
    ],
  );
  const S = sample();
  const items = planItems(
    [{ p: S.machines[0], kind: "machine", line: "", dept: "" }],
    { co: S.co, logo: S.logo },
  ).data;
  assert.deepEqual(
    imgRefs(items).map((r) => r.what),
    ["Control panel photo 1", "Logo"],
  );
  assert.deepEqual(imgRefs(null), []);
});

test("similarPath finds a near match for a missing photo", () => {
  const names = [
    "data.json",
    "photos/Line 1/Widget A/step-2.JPG",
    "photos/Other/product-1.jpg",
    "logo.png",
  ];
  assert.equal(
    similarPath("photos/Line 1/Widget A/step-2.jpg", names),
    "photos/Line 1/Widget A/step-2.JPG",
  );
  assert.equal(
    similarPath("photos/Line 1/Widget A/step-2.png", names),
    "photos/Line 1/Widget A/step-2.JPG",
  );
  assert.equal(
    similarPath("photos/Line 1/Widget A/product-1.jpg", names),
    "photos/Other/product-1.jpg",
  );
  assert.equal(similarPath("photos/x/panel-9.jpg", names), "");
});

test("sub-step photos: storage refs, ZIP paths and missing-photo report", () => {
  const S = sample();
  S.lines[0].products[0].steps[1].subs = [
    { t: "a", img: "" },
    { t: "b", img: "data:image/jpeg;base64,EEEE" },
  ];
  const { data, files } = planBackup(S);
  const w = data.lines[0].products[0];
  assert.deepEqual(w.steps[1].subs, [
    { t: "a", img: "" },
    { t: "b", img: "photos/Line 1/Widget A/step-2-2.jpg" },
  ]);
  assert.equal("subs" in w.steps[0], false); // steps without sub-steps stay as they were
  assert.ok(files.some(([p]) => p == "photos/Line 1/Widget A/step-2-2.jpg"));
  const back = restoreImgs(JSON.parse(JSON.stringify(data)), new Map(files));
  assert.deepEqual(back.data.lines, S.lines);
  assert.ok(
    imgRefs(data).some(
      (r) => r.what == "Step 2.2 photo" && r.path.endsWith("step-2-2.jpg"),
    ),
  );
});

test("sha256 matches known values", () => {
  const { sha256 } = require("../js/utils.js");
  assert.equal(
    sha256(""),
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  );
  assert.equal(
    sha256("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
  assert.equal(
    sha256("x".repeat(200)),
    require("node:crypto")
      .createHash("sha256")
      .update("x".repeat(200))
      .digest("hex"),
  );
});

test("access codes ignore case, spaces and dashes", () => {
  const { codeHash, normCode } = require("../js/utils.js");
  assert.equal(normCode(" ab12-cd34 ef "), "AB12CD34EF");
  assert.equal(codeHash("ab12-cd34"), codeHash("AB12 CD34"));
  assert.notEqual(codeHash("AB12CD34"), codeHash("AB12CD35"));
});

test("codeRef is the first 6 characters of the scrambled code", () => {
  const { codeRef, codeHash } = require("../js/utils.js");
  assert.equal(codeRef("6aa16572f037"), "6AA165");
  assert.equal(codeRef(""), "");
  assert.equal(codeRef(codeHash("A1B2C3")).length, 6);
});

test("tracking dots encode and decode the reference", () => {
  const { refBits, bitsRef } = require("../js/utils.js");
  const bits = refBits("6aa165");
  assert.equal(bits.length, 28);
  assert.equal(bits.slice(0, 8).join(""), "01101010"); // 6, A
  assert.equal(bitsRef(bits), "6AA165");
  assert.equal(bitsRef(bits.join("").replace(/(.{4})/g, "$1 ")), "6AA165");
  const bad = [...bits];
  bad[3] ^= 1; // one misread dot
  assert.equal(bitsRef(bad), "");
  assert.deepEqual(refBits("XYZ"), []);
});

test('stableJson gives the same text whatever the key order', () => {
  const { stableJson } = require('../js/utils.js');
  assert.equal(stableJson({ b: 1, a: [2, { d: 3, c: null }] }), stableJson({ a: [2, { c: null, d: 3 }], b: 1 }));
  assert.equal(stableJson({ a: undefined, b: 1 }), '{"b":1}');
});

test('approval fingerprint ignores "Approved by" and the approval, but not content', async () => {
  const { apFingerprint } = require('../js/utils.js');
  const p = { name: 'Widget', rev: '1', by: 'Alex', steps: [{ h: 'Fit', t: 'Do it', img: 'data:image/jpeg;base64,AAAA', subs: [] }], tools: [{ n: 'Wrench', s: '', q: '1' }, { n: ' ', s: '', q: '' }] };
  const fp = await apFingerprint(p, 'product', 'Press');
  assert.equal(fp, await apFingerprint({ ...p, appr: 'Sam', ap: { st: 'approved' }, id: 'x' }, 'product', 'Press'));
  assert.equal(fp, await apFingerprint({ ...p, tools: [p.tools[0]] }, 'product', 'Press'), 'empty tool rows do not count');
  assert.notEqual(fp, await apFingerprint({ ...p, rev: '2' }, 'product', 'Press'));
  assert.notEqual(fp, await apFingerprint({ ...p, steps: [{ ...p.steps[0], img: 'data:image/jpeg;base64,AAAB' }] }, 'product', 'Press'));
  assert.notEqual(fp, await apFingerprint({ ...p, steps: [{ ...p.steps[0], warn: '' }] }, 'product', 'Press'), 'adding a note counts');
  assert.notEqual(fp, await apFingerprint(p, 'product', 'Assembly'));
});

test('approver codes sign approvals that only check out unchanged and from listed approvers', async () => {
  const { apKeys, apSign, apCheck } = require('../js/utils.js');
  const a = await apKeys('abcd-efgh-jkmn-pqrs'), b = await apKeys('ABCD EFGH JKMN PQRS'), other = await apKeys('ZZZZ-ZZZZ-ZZZZ-ZZZZ');
  assert.equal(a.pub, b.pub, 'case, spaces and dashes do not matter');
  assert.notEqual(a.pub, other.pub);
  const payload = { decision: 'approved', fp: 'abc', approver: 'Sam', at: '2026-11-17T10:00:00Z' };
  const file = { format: 'setup-procedures-approval', version: 1, payload, pub: a.pub, sig: await apSign(a.priv, payload) };
  const list = [['Sam', a.pub]];
  assert.equal((await apCheck(file, list)).ok, true);
  assert.equal((await apCheck(file, list)).name, 'Sam');
  assert.match((await apCheck({ ...file, payload: { ...payload, fp: 'abd' } }, list)).why, /changed since it was signed/);
  assert.match((await apCheck(file, [['Other', other.pub]])).why, /not \(or no longer\) on the list/);
  assert.match((await apCheck({ format: 'x' }, list)).why, /not an approval file/);
  const forged = { ...file, pub: other.pub, sig: await apSign(other.priv, payload) };
  assert.equal((await apCheck(forged, list)).ok, false, 'a different code cannot sign for Sam');
});

test('itemDiff describes what changed in plain words', () => {
  const { itemDiff } = require('../js/utils.js');
  const co = { depts: [{ id: 'd1', name: 'Press' }, { id: 'd2', name: 'Assembly' }] };
  const a = { name: 'Widget', code: 'W1', rev: '3', dept: 'd1', prod: ['x'], pack: [], ppe: [], tools: [{ n: '', s: '', q: '' }], steps: [{ t: 'a' }, { t: 'b' }], by: 'Alex' };
  assert.deepEqual(itemDiff(a, { ...a, tools: [] }, co, 'product'), [], 'empty tool rows do not count');
  const b = { ...a, rev: '4', dept: 'd2', prod: ['x', 'y'], ppe: ['gloves'], tools: [{ n: 'Wrench', s: '', q: '1' }], steps: [{ t: 'a' }, { t: 'B' }, { t: 'c' }], by: '', ap: { st: 'approved' }, appr: 'Sam' };
  assert.deepEqual(itemDiff(a, b, co, 'product'), [
    'Revision "3" → "4"',
    'Department "Press" → "Assembly"',
    'Product photos 1 → 2',
    'Safety equipment',
    'Tools required',
    'Steps 2 → 3',
    'Step 2 changed',
    'Prepared by cleared',
  ]);
  assert.deepEqual(itemDiff({ ...a, code: '' }, a, co, 'machine'), ['Asset ID set to "W1"']);
});

test("steps and sub-steps can hold several photos (img, then more)", async () => {
  const { photosOf, setPhotos, apContent, apFingerprint } = require("../js/utils.js");
  const A = "data:image/jpeg;base64,AAAA",
    B = "data:image/jpeg;base64,BBBB",
    C = "data:image/jpeg;base64,CCCC";
  const o = { t: "x", img: "" };
  assert.deepEqual(photosOf(o), []);
  setPhotos(o, [A]);
  assert.deepEqual(o, { t: "x", img: A }, "one photo: no more field");
  setPhotos(o, [A, B, C]);
  assert.deepEqual(o, { t: "x", img: A, more: [B, C] });
  assert.deepEqual(photosOf(o), [A, B, C]);
  setPhotos(o, photosOf(o).filter((x) => x != A));
  assert.deepEqual(o, { t: "x", img: B, more: [C] });

  // Backup: step-1.jpg, step-1 (2).jpg …; restored exactly; each listed.
  const S = {
    co: { name: "Co", depts: [] },
    lines: [
      {
        id: "l",
        name: "Line",
        products: [
          {
            id: "p",
            name: "W",
            prod: [],
            pack: [],
            steps: [{ t: "a", img: A, more: [B], subs: [{ t: "s", img: C, more: [A] }] }],
          },
        ],
      },
    ],
    machines: [],
  };
  const { data, files } = planBackup(S),
    st = data.lines[0].products[0].steps[0];
  assert.equal(st.img, "photos/Line/W/step-1.jpg");
  assert.deepEqual(st.more, ["photos/Line/W/step-1 (2).jpg"]);
  assert.equal(st.subs[0].img, "photos/Line/W/step-1-1.jpg");
  assert.deepEqual(st.subs[0].more, ["photos/Line/W/step-1.jpg"], "same photo reused");
  const json = JSON.parse(JSON.stringify(data));
  assert.equal(imgPaths(json).size, 3);
  const back = restoreImgs(json, new Map(files));
  assert.equal(back.missing, 0);
  assert.deepEqual(back.data.lines, S.lines);
  assert.deepEqual(
    imgRefs(json).map((r) => r.what),
    ["Step 1 photo", "Step 1 photo 2", "Step 1.1 photo", "Step 1.1 photo 2"],
  );

  // Approvals: an item with one photo per step fingerprints as before;
  // adding a second photo is a change.
  const p = { name: "W", steps: [{ t: "a", img: A, subs: [] }] },
    h = (x) => x.slice(-4);
  assert.deepEqual(apContent(p, "product", "", h).steps[0].img, "AAAA");
  assert.equal(apContent(p, "product", "", h).steps[0].more, undefined);
  assert.notEqual(
    await apFingerprint(p, "product", ""),
    await apFingerprint({ ...p, steps: [{ ...p.steps[0], more: [B] }] }, "product", ""),
  );
});

test("imported products join a line whose name differs only in spaces or capitals", () => {
  const { addItem, nameKey } = require("../js/utils.js");
  assert.equal(nameKey("  Line  1 "), "line 1");
  const S = { co: { depts: [] }, lines: [{ id: "l", name: "Line 1", products: [] }], machines: [] };
  addItem(S, { kind: "product", line: "line  1", item: { name: "W", steps: [] } }, () => false);
  assert.equal(S.lines.length, 1);
  assert.equal(S.lines[0].products.length, 1);
});

test("pdfChecks lists what is missing before printing", () => {
  const { pdfChecks } = require("../js/utils.js");
  const full = {
    prod: ["data:image/jpeg;base64,AAAA"],
    ppe: ["gloves"],
    tools: [{ n: "Wrench" }],
    steps: [{ h: "", t: "Do it", subs: [{ t: "Check" }] }],
  };
  assert.deepEqual(pdfChecks(full, "product"), []);
  assert.deepEqual(
    pdfChecks(
      {
        steps: [
          { t: "", warn: "" },
          { t: "ok", subs: [{ t: "" }] },
        ],
      },
      "machine",
    ),
    [
      "There is no machine photo.",
      "No safety equipment is ticked.",
      "No tools are listed.",
      "Step 1 has no text.",
      "Step 1 has an empty warning or note.",
      "Step 2.1 has no text.",
    ],
  );
  assert.ok(pdfChecks({ steps: [] }, "product").includes("There are no steps."));
});

test("machine settings count for approvals and change history only when there are some", async () => {
  const { apFingerprint, itemDiff, settingsOf } = require("../js/utils.js");
  const p = { name: "W", steps: [{ t: "a", subs: [] }] },
    co = { depts: [] };
  assert.equal(
    await apFingerprint(p, "product", ""),
    await apFingerprint({ ...p, set: [{ n: " ", v: "", u: "" }] }, "product", ""),
    "empty rows do not count",
  );
  const q = { ...p, set: [{ n: "Temperature", v: "220", u: "°C" }] };
  assert.notEqual(await apFingerprint(p, "product", ""), await apFingerprint(q, "product", ""));
  assert.deepEqual(settingsOf(q), q.set);
  assert.deepEqual(itemDiff(p, q, co, "product"), ["Machine settings"]);
});

test("pdfName gives a readable PDF file name", () => {
  const { pdfName } = require("../js/utils.js");
  const d = new Date(2026, 10, 27);
  assert.equal(
    pdfName({ name: "Widget A", code: "WA-100-B", rev: "4" }, true, false, d),
    "Widget A - WA-100-B - Rev 4 - 2026-11-27.pdf",
  );
  assert.equal(
    pdfName({ name: "Press: 3/4", rev: "" }, false, false, d),
    "Press 3 4 - Rev 1 - 2026-11-27 - DRAFT.pdf",
  );
  assert.equal(
    pdfName({ name: "", code: " " }, false, true, d),
    "REVIEW - Setup procedure - Rev 1 - 2026-11-27.pdf",
  );
});

test("the app version is the same in js/version.js, package.json and CHANGELOG.md", () => {
  const fs = require("fs"),
    path = require("path"),
    root = path.join(__dirname, ".."),
    v = fs.readFileSync(path.join(root, "js/version.js"), "utf8"),
    ver = (v.match(/APP_VERSION = "([^"]+)"/) || [])[1],
    date = (v.match(/APP_DATE = "([^"]+)"/) || [])[1];
  assert.match(ver, /^\d+\.\d+\.\d+$/, "MAJOR.MINOR.PATCH");
  assert.match(date, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(require("../package.json").version, ver);
  assert.ok(
    fs.readFileSync(path.join(root, "CHANGELOG.md"), "utf8").includes(`## ${ver} · ${date}`),
    "CHANGELOG.md has an entry for this version",
  );
});
