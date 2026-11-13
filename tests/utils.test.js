const { test } = require('node:test');
const assert = require('node:assert/strict');
const { id, esc, parseBackup, toMinutes, fmtTime, normCo, deptOf, deptName } = require('../js/utils.js');

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
