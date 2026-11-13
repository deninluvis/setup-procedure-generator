const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Zip } = require('../js/zip.js');

const enc = new TextEncoder(), dec = new TextDecoder();

test('crc32 matches the standard value', () => {
  assert.equal(Zip.crc32(enc.encode('123456789')), 0xcbf43926);
});

test('make then read gives back the same files', async () => {
  const photo = new Uint8Array(5000).map((_, i) => (i * 7) & 255);
  const blob = Zip.make([
    { name: 'data.json', data: enc.encode('{"a":1}') },
    { name: 'photos/Línea 1/Widget A/step-1.jpg', data: photo },
  ]);
  const buf = await blob.arrayBuffer();
  assert.equal(Zip.isZip(buf), true);
  const files = await Zip.read(buf);
  assert.deepEqual([...files.keys()], ['data.json', 'photos/Línea 1/Widget A/step-1.jpg']);
  assert.equal(dec.decode(files.get('data.json')), '{"a":1}');
  assert.deepEqual(files.get('photos/Línea 1/Widget A/step-1.jpg'), photo);
});

test('reads a compressed ZIP re-saved by another program (Python zipfile)', async () => {
  const b = fs.readFileSync(path.join(__dirname, 'fixtures', 'resaved.zip'));
  const files = await Zip.read(b.buffer.slice(b.byteOffset, b.byteOffset + b.length));
  assert.equal(JSON.parse(dec.decode(files.get('My backup/data.json'))).note, 'Größe ✓');
  assert.equal(dec.decode(files.get('My backup/photos/Linie Ä/step-1.txt')), 'hello '.repeat(200));
  assert.equal(files.has('My backup/'), false); // folders are skipped
});

test('isZip and read reject other files', async () => {
  const notZip = enc.encode('{"lines":[]}').buffer;
  assert.equal(Zip.isZip(notZip), false);
  await assert.rejects(Zip.read(notZip), /Not a ZIP/);
});
