const { test } = require('node:test');
const assert = require('node:assert/strict');
const { id, esc, tot, parseBackup } = require('../js/utils.js');

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

test('tot sums minutes and finds the most people at once', () => {
  const p = { res: [{ n: '2', m: '10' }, { n: '3', m: '5' }, { n: '', m: 'x' }] };
  assert.equal(tot(p), 'Most people at once: 3  ·  Total time: 15 min');
  assert.equal(tot({}), 'Most people at once: 0  ·  Total time: 0 min');
});

test('parseBackup accepts valid backups and rejects others', () => {
  assert.deepEqual(parseBackup({ lines: [] }), { lines: [], machines: [] });
  assert.deepEqual(parseBackup({ lines: [1], machines: [2] }), { lines: [1], machines: [2] });
  assert.deepEqual(parseBackup({ lines: [], machines: 'bad' }), { lines: [], machines: [] });
  assert.equal(parseBackup(null), null);
  assert.equal(parseBackup({}), null);
  assert.equal(parseBackup({ lines: 'nope' }), null);
});
