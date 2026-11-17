const { test } = require('node:test');
const assert = require('node:assert/strict');
const { id, esc, parseBackup, toMinutes, fmtTime, normCo, deptOf, deptName, fmtBytes } = require('../js/utils.js');

test('esc escapes HTML special characters', () => {
  assert.equal(esc('<a href="x">&</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
  assert.equal(esc(null), '');
  assert.equal(esc(undefined), '');
  assert.equal(esc(42), '42');
});

test('id returns short random strings', () => {
  const a = id();
  assert.match(a, /^[a-z0-9]{1,7}$/);
  assert.notEqual(a, id());
});

test('toMinutes combines hours and minutes, null when both empty', () => {
  assert.equal(toMinutes('1', '30'), 90);
  assert.equal(toMinutes('', '45'), 45);
  assert.equal(toMinutes('2', ''), 120);
  assert.equal(toMinutes('0', '90'), 90);
  assert.equal(toMinutes('', ''), null);
  assert.equal(toMinutes(undefined, undefined), null);
});

test('fmtTime shows hours and minutes', () => {
  assert.equal(fmtTime(90), '1 h 30 min');
  assert.equal(fmtTime(45), '0 h 45 min');
  assert.equal(fmtTime(125), '2 h 5 min');
  assert.equal(fmtTime(null), '');
});

test('parseBackup accepts valid backups and rejects others', () => {
  const noCo = { name: '', depts: [] };
  assert.deepEqual(parseBackup({ lines: [] }), { lines: [], machines: [], co: noCo });
  assert.deepEqual(parseBackup({ lines: [1], machines: [2] }), { lines: [1], machines: [2], co: noCo });
  assert.deepEqual(parseBackup({ lines: [], machines: 'bad' }), { lines: [], machines: [], co: noCo });
  assert.deepEqual(parseBackup({ lines: [], co: { name: 'ACME', depts: [{ id: 'a', name: 'Assembly' }], done: true } }).co,
    { name: 'ACME', depts: [{ id: 'a', name: 'Assembly' }], done: true });
  assert.equal(parseBackup({ lines: [], co: { name: ' ', done: true } }).co.done, undefined);
  assert.equal(parseBackup(null), null);
  assert.equal(parseBackup({}), null);
  assert.equal(parseBackup({ lines: 'nope' }), null);
  assert.equal(parseBackup({ lines: [], logo: 'data:image/png;base64,AAA' }).logo, 'data:image/png;base64,AAA');
  assert.equal('logo' in parseBackup({ lines: [], logo: 'javascript:alert(1)' }), false);
});

test('normCo upgrades a single old department and cleans the list', () => {
  assert.deepEqual(normCo({ name: 'ACME', dept: 'Assembly', done: true }),
    { name: 'ACME', depts: [{ id: 'd1', name: 'Assembly' }], done: true });
  assert.deepEqual(normCo({ name: 'ACME', dept: '  ' }), { name: 'ACME', depts: [] });
  assert.deepEqual(normCo({ name: 'X', depts: [null, 'bad', { id: 'p', name: 'Press' }] }).depts, [{ id: 'p', name: 'Press' }]);
  assert.equal(normCo({ depts: [{ name: 'No id' }] }).depts[0].id.length > 0, true);
  assert.deepEqual(normCo(undefined), { name: '', depts: [] });
});

test('deptOf and deptName pick the right department', () => {
  const co = { depts: [{ id: 'a', name: 'Assembly' }, { id: 'p', name: 'Press' }] };
  assert.equal(deptOf({}, co), 'a'); // older items use the first department
  assert.equal(deptOf({ dept: 'p' }, co), 'p');
  assert.equal(deptOf({ dept: '' }, co), '');
  assert.equal(deptOf({}, { depts: [] }), '');
  assert.equal(deptName('p', co), 'Press');
  assert.equal(deptName('gone', co), '');
  assert.equal(deptName('', co), '');
});

test('fmtBytes shows KB, MB and GB', () => {
  assert.equal(fmtBytes(0), '1 KB');
  assert.equal(fmtBytes(512 * 1024), '512 KB');
  assert.equal(fmtBytes(12.34 * 1024 * 1024), '12.3 MB');
  assert.equal(fmtBytes(1.5 * 1024 ** 3), '1.5 GB');
});

const { imgRefs, similarPath, dateStamp, safeName, imgExt, planBackup, planItems, itemPacks, deptItems, lineItems, imgPaths, restoreImgs, addItem, daysSince, agoText, backupDue } = require('../js/utils.js');
const JPG = 'data:image/jpeg;base64,AAAA', JPG2 = 'data:image/jpeg;base64,BBBB', PNG = 'data:image/png;base64,CCCC';
const sample = () => ({
  co: { name: 'ACME', depts: [{ id: 'a', name: 'Assembly' }], done: true },
  logo: PNG,
  lines: [{ id: 'l1', name: 'Line 1', products: [
    { id: 'p1', name: 'Widget A', dept: 'a', prod: [JPG], pack: [JPG2], steps: [{ t: 'one', img: '' }, { t: 'two', img: JPG }] },
    { id: 'p2', name: 'Widget A', prod: [], pack: [], steps: [{ t: 'x', img: JPG2 }] },
  ] }],
  machines: [{ id: 'm1', name: 'Press: 3/4', prod: [], pack: [JPG2], steps: [] }],
});

test('dateStamp, safeName and imgExt', () => {
  assert.equal(dateStamp(new Date(2026, 0, 5)), '2026-01-05');
  assert.equal(safeName('Press: 3/4*  ', 'X'), 'Press 3 4');
  assert.equal(safeName(' ..', 'Fallback'), 'Fallback');
  assert.equal(imgExt(JPG), 'jpg');
  assert.equal(imgExt(PNG), 'png');
});

test('planBackup gives readable unique paths and stores each image once', () => {
  const { data, files } = planBackup(sample());
  assert.equal(data.format, 'setup-procedures-backup');
  assert.equal(data.logo, 'logo.png');
  const [a, b] = data.lines[0].products;
  assert.deepEqual(a.prod, ['photos/Line 1/Widget A/product-1.jpg']);
  assert.deepEqual(a.pack, ['photos/Line 1/Widget A/packaging-1.jpg']);
  assert.equal(a.steps[0].img, '');
  assert.equal(a.steps[1].img, 'photos/Line 1/Widget A/product-1.jpg'); // same image reused
  assert.equal(b.steps[0].img, 'photos/Line 1/Widget A/packaging-1.jpg');
  assert.deepEqual(data.machines[0].pack, ['photos/Line 1/Widget A/packaging-1.jpg']);
  assert.deepEqual(files.map((f) => f[0]).sort(), ['logo.png', 'photos/Line 1/Widget A/packaging-1.jpg', 'photos/Line 1/Widget A/product-1.jpg']);
});

test('duplicate names get separate folders', () => {
  const S = sample();
  S.lines[0].products[1].prod = ['data:image/jpeg;base64,DDDD'];
  const { data } = planBackup(S);
  assert.deepEqual(data.lines[0].products[1].prod, ['photos/Line 1/Widget A (2)/product-1.jpg']);
});

test('backup round trip: paths back to images, missing ones counted', () => {
  const S = sample(), { data, files } = planBackup(S);
  const json = JSON.parse(JSON.stringify(data));
  assert.equal(imgPaths(json).size, 3);
  const all = restoreImgs(json, new Map(files));
  assert.equal(all.missing, 0);
  assert.deepEqual(all.data.lines, S.lines);
  assert.deepEqual(all.data.machines, S.machines);
  assert.equal(all.data.logo, PNG);
  const some = restoreImgs(json, new Map(files.filter(([p]) => p != 'logo.png')));
  assert.equal(some.missing, 1);
  assert.equal('logo' in some.data, false);
});

test('planItems and restore for several items', () => {
  const S = sample();
  const list = [
    { p: S.machines[0], kind: 'machine', line: '', dept: 'Assembly' },
    { p: S.lines[0].products[0], kind: 'product', line: 'Line 1', dept: 'Assembly' },
  ];
  const { data, files } = planItems(list);
  assert.equal(data.format, 'setup-procedures-items');
  assert.deepEqual(data.items[0].item.pack, ['photos/Machines/Press 3 4/panel-1.jpg']);
  assert.deepEqual(data.items[1].item.prod, ['photos/Line 1/Widget A/product-1.jpg']);
  assert.equal(data.items[1].line, 'Line 1');
  const back = restoreImgs(JSON.parse(JSON.stringify(data)), new Map(files));
  assert.equal(back.missing, 0);
  assert.deepEqual(back.data.items.map((x) => x.item), [S.machines[0], S.lines[0].products[0]]);
  assert.deepEqual(itemPacks(back.data).map((x) => x.kind), ['machine', 'product']);
});

test('itemPacks reads the older single-item format and rejects backups', () => {
  const old = { format: 'setup-procedures-item', kind: 'machine', item: { name: 'M' } };
  assert.deepEqual(itemPacks(old), [{ ...old, kind: 'machine' }]);
  const r = restoreImgs({ ...old, item: { name: 'M', prod: ['photos/M/machine-1.jpg'], pack: [], steps: [] } }, new Map([['photos/M/machine-1.jpg', JPG]]));
  assert.deepEqual(r.data.item.prod, [JPG]);
  assert.equal(itemPacks({ lines: [] }), null);
  assert.equal(itemPacks({ format: 'setup-procedures-items', items: [] }), null);
  assert.equal(itemPacks(null), null);
});

test('deptItems and lineItems pick the right products and machines', () => {
  const S = sample();
  S.machines[0].dept = 'a';
  // p1 has dept 'a'; p2 has no dept field, so it uses the first department ('a') too
  assert.deepEqual(deptItems(S, 'a').map((x) => [x.kind, x.p.id, x.line, x.dept]),
    [['product', 'p1', 'Line 1', 'Assembly'], ['product', 'p2', 'Line 1', 'Assembly'], ['machine', 'm1', '', 'Assembly']]);
  S.lines[0].products[1].dept = '';
  assert.equal(deptItems(S, 'a').length, 2);
  assert.deepEqual(lineItems(S, 'l1').map((x) => x.p.id), ['p1', 'p2']);
  assert.deepEqual(lineItems(S, 'nope'), []);
});

test('backup reminder after 7 days, only when there is something to lose', () => {
  const now = new Date(2026, 10, 13, 9).getTime(), day = 864e5;
  assert.equal(daysSince(new Date(2026, 10, 12, 23).getTime(), now), 1);
  assert.equal(agoText(null, now), 'never');
  assert.equal(agoText(now - 3600e3, now), 'today');
  assert.equal(agoText(now - day, now), 'yesterday');
  assert.equal(agoText(now - 9 * day, now), '9 days ago');
  const S = sample();
  assert.equal(backupDue(S, now), true); // never backed up
  S.lastBackup = now - 6 * day;
  assert.equal(backupDue(S, now), false);
  S.lastBackup = now - 7 * day;
  assert.equal(backupDue(S, now), true);
  assert.equal(backupDue({ lines: [{ products: [] }], machines: [] }, now), false); // nothing yet
});

test('addItem places products by line and department name', () => {
  const S = sample();
  const pk = { kind: 'product', line: 'line 1', dept: 'Painting', item: { id: 'x', name: 'Gadget', prod: [], pack: [], steps: [] } };
  const r = addItem(S, pk, () => assert.fail('no clash expected'));
  assert.equal(r.lineId, 'l1');
  assert.notEqual(r.item.id, 'x');
  assert.equal(S.lines[0].products.length, 3);
  assert.equal(S.co.depts[1].name, 'Painting'); // new department created
  assert.equal(r.item.dept, S.co.depts[1].id);
  const r2 = addItem(S, { ...pk, line: 'New line', dept: 'assembly' }, () => false);
  assert.equal(S.lines[1].name, 'New line');
  assert.equal(r2.item.dept, 'a'); // matched existing department, any case
});

test('addItem with a name clash replaces or keeps both', () => {
  const S = sample();
  const pk = { kind: 'machine', item: { name: 'press: 3/4', prod: [], pack: [], steps: [] } };
  const kept = addItem(S, pk, () => false);
  assert.equal(S.machines.length, 2);
  assert.equal(kept.item.name, 'press: 3/4 (imported)');
  assert.equal(addItem(S, pk, () => false).item.name, 'press: 3/4 (imported 2)');
  S.machines.pop();
  const rep = addItem(S, pk, (name, where) => where == 'Machines');
  assert.equal(rep.replaced, true);
  assert.equal(S.machines.length, 2);
  assert.equal(S.machines[0].id, 'm1'); // keeps its place and id
  assert.equal(S.machines[0].name, 'press: 3/4');
});

test('imgRefs says where every photo belongs', () => {
  const { data } = planBackup(sample());
  const refs = imgRefs(JSON.parse(JSON.stringify(data)));
  assert.deepEqual(refs.map((r) => [r.item, r.kind, r.line, r.what]), [
    ['Widget A', 'product', 'Line 1', 'Product photo 1'],
    ['Widget A', 'product', 'Line 1', 'Packaging photo 1'],
    ['Widget A', 'product', 'Line 1', 'Step 2 photo'],
    ['Widget A', 'product', 'Line 1', 'Step 1 photo'],
    ['Press: 3/4', 'machine', '', 'Control panel photo 1'],
    ['Company logo', 'logo', '', 'Logo'],
  ]);
  const S = sample();
  const items = planItems([{ p: S.machines[0], kind: 'machine', line: '', dept: '' }], { co: S.co, logo: S.logo }).data;
  assert.deepEqual(imgRefs(items).map((r) => r.what), ['Control panel photo 1', 'Logo']);
  assert.deepEqual(imgRefs(null), []);
});

test('similarPath finds a near match for a missing photo', () => {
  const names = ['data.json', 'photos/Line 1/Widget A/step-2.JPG', 'photos/Other/product-1.jpg', 'logo.png'];
  assert.equal(similarPath('photos/Line 1/Widget A/step-2.jpg', names), 'photos/Line 1/Widget A/step-2.JPG');
  assert.equal(similarPath('photos/Line 1/Widget A/step-2.png', names), 'photos/Line 1/Widget A/step-2.JPG');
  assert.equal(similarPath('photos/Line 1/Widget A/product-1.jpg', names), 'photos/Other/product-1.jpg');
  assert.equal(similarPath('photos/x/panel-9.jpg', names), '');
});

test('sub-step photos: storage refs, ZIP paths and missing-photo report', () => {
  const S = sample();
  S.lines[0].products[0].steps[1].subs = [{ t: 'a', img: '' }, { t: 'b', img: 'data:image/jpeg;base64,EEEE' }];
  const { data, files } = planBackup(S);
  const w = data.lines[0].products[0];
  assert.deepEqual(w.steps[1].subs, [{ t: 'a', img: '' }, { t: 'b', img: 'photos/Line 1/Widget A/step-2-2.jpg' }]);
  assert.equal('subs' in w.steps[0], false); // steps without sub-steps stay as they were
  assert.ok(files.some(([p]) => p == 'photos/Line 1/Widget A/step-2-2.jpg'));
  const back = restoreImgs(JSON.parse(JSON.stringify(data)), new Map(files));
  assert.deepEqual(back.data.lines, S.lines);
  assert.ok(imgRefs(data).some((r) => r.what == 'Step 2.2 photo' && r.path.endsWith('step-2-2.jpg')));
});

test('sha256 matches known values', () => {
  const { sha256 } = require('../js/utils.js');
  assert.equal(sha256(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(sha256('x'.repeat(200)), require('node:crypto').createHash('sha256').update('x'.repeat(200)).digest('hex'));
});

test('access codes ignore case, spaces and dashes', () => {
  const { codeHash, normCode } = require('../js/utils.js');
  assert.equal(normCode(' ab12-cd34 ef '), 'AB12CD34EF');
  assert.equal(codeHash('ab12-cd34'), codeHash('AB12 CD34'));
  assert.notEqual(codeHash('AB12CD34'), codeHash('AB12CD35'));
});

test('codeRef is the first 6 characters of the scrambled code', () => {
  const { codeRef, codeHash } = require('../js/utils.js');
  assert.equal(codeRef('6aa16572f037'), '6AA165');
  assert.equal(codeRef(''), '');
  assert.equal(codeRef(codeHash('A1B2C3')).length, 6);
});
