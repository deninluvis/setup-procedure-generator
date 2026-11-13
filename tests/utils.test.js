const { test } = require('node:test');
const assert = require('node:assert/strict');
const { id, esc, tot, parseBackup, rowMinutes, fmtTime, rowUsed, staffTotals } = require('../js/utils.js');

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

test('rowMinutes combines hours and minutes, null when both empty', () => {
  assert.equal(rowMinutes({ h: '1', m: '30' }), 90);
  assert.equal(rowMinutes({ h: '', m: '45' }), 45);
  assert.equal(rowMinutes({ h: '2', m: '' }), 120);
  assert.equal(rowMinutes({ h: '', m: '' }), null);
  assert.equal(rowMinutes({}), null);
});

test('fmtTime shows hours and minutes', () => {
  assert.equal(fmtTime(90), '1 h 30 min');
  assert.equal(fmtTime(45), '0 h 45 min');
  assert.equal(fmtTime(125), '2 h 5 min');
  assert.equal(fmtTime(null), '');
});

test('rowUsed ignores completely empty rows', () => {
  assert.equal(rowUsed({ r: '', n: '', h: '', m: '' }), false);
  assert.equal(rowUsed({ r: ' ', n: '2' }), true);
});

test('staffTotals is complete only when every used row has people and time', () => {
  const full = { res: [{ r: 'Op', n: '2', h: '1', m: '0' }, { r: 'QC', n: '3', h: '', m: '20' }, { r: '', n: '', h: '', m: '' }] };
  assert.deepEqual(staffTotals(full), { people: 3, minutes: 80, complete: true });
  const partial = { res: [{ r: 'Op', n: '2', h: '', m: '' }] };
  assert.equal(staffTotals(partial).complete, false);
  assert.equal(staffTotals({}).complete, false);
});

test('tot summarizes in hours and minutes and flags empty fields', () => {
  assert.equal(tot({ res: [{ r: 'Op', n: '2', h: '1', m: '15' }] }), 'Most people at once: 2  ·  Total time: 1 h 15 min');
  assert.match(tot({ res: [{ r: 'Op', n: '', h: '', m: '' }] }), /left blank on the PDF/);
});

test('parseBackup accepts valid backups and rejects others', () => {
  assert.deepEqual(parseBackup({ lines: [] }), { lines: [], machines: [] });
  assert.deepEqual(parseBackup({ lines: [1], machines: [2] }), { lines: [1], machines: [2] });
  assert.deepEqual(parseBackup({ lines: [], machines: 'bad' }), { lines: [], machines: [] });
  assert.equal(parseBackup(null), null);
  assert.equal(parseBackup({}), null);
  assert.equal(parseBackup({ lines: 'nope' }), null);
});
