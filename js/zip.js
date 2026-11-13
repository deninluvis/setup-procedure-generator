// Minimal ZIP writer and reader, so backups need no library or internet.
// Writes files uncompressed ("stored"): photos are already compressed.
// Reads stored and deflated files, so a ZIP re-saved by Windows, macOS or
// other tools also imports. Not for files over 4 GB.
const Zip = (() => {
  const TABLE = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    TABLE[n] = c >>> 0;
  }
  const crc32 = (b) => {
    let c = 0xffffffff;
    for (let i = 0; i < b.length; i++) c = TABLE[(c ^ b[i]) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const enc = new TextEncoder(),
    dec = new TextDecoder();

  // files: [{ name, data: Uint8Array }] -> Blob
  function make(files) {
    const now = new Date(),
      time =
        (now.getHours() << 11) |
        (now.getMinutes() << 5) |
        (now.getSeconds() >> 1),
      date =
        ((now.getFullYear() - 1980) << 9) |
        ((now.getMonth() + 1) << 5) |
        now.getDate(),
      parts = [],
      central = [];
    let offset = 0;
    for (const f of files) {
      const name = enc.encode(f.name),
        crc = crc32(f.data),
        size = f.data.length;
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); // local file header
      h.setUint16(4, 20, true); // version needed
      h.setUint16(6, 0x0800, true); // flag: names are UTF-8
      h.setUint16(10, time, true);
      h.setUint16(12, date, true);
      h.setUint32(14, crc, true);
      h.setUint32(18, size, true);
      h.setUint32(22, size, true);
      h.setUint16(26, name.length, true);
      parts.push(h, name, f.data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); // central directory entry
      c.setUint16(4, 20, true);
      c.setUint16(6, 20, true);
      c.setUint16(8, 0x0800, true);
      c.setUint16(12, time, true);
      c.setUint16(14, date, true);
      c.setUint32(16, crc, true);
      c.setUint32(20, size, true);
      c.setUint32(24, size, true);
      c.setUint16(28, name.length, true);
      c.setUint32(42, offset, true);
      central.push(c, name);
      offset += 30 + name.length + size;
    }
    const cdSize = central.reduce((a, x) => a + x.byteLength, 0),
      e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); // end of central directory
    e.setUint16(8, files.length, true);
    e.setUint16(10, files.length, true);
    e.setUint32(12, cdSize, true);
    e.setUint32(16, offset, true);
    return new Blob([...parts, ...central, e], { type: "application/zip" });
  }

  const inflate = async (bytes) =>
    new Uint8Array(
      await new Response(
        new Blob([bytes])
          .stream()
          .pipeThrough(new DecompressionStream("deflate-raw")),
      ).arrayBuffer(),
    );

  // ArrayBuffer -> Map(name -> Uint8Array). Throws if it is not a ZIP file.
  async function read(buf) {
    const u = new Uint8Array(buf),
      v = new DataView(buf);
    let e = -1;
    for (let i = u.length - 22; i >= Math.max(0, u.length - 65557); i--)
      if (v.getUint32(i, true) == 0x06054b50) {
        e = i;
        break;
      }
    if (e < 0) throw new Error("Not a ZIP file");
    const n = v.getUint16(e + 10, true),
      out = new Map();
    let p = v.getUint32(e + 16, true);
    for (let k = 0; k < n; k++) {
      if (v.getUint32(p, true) != 0x02014b50)
        throw new Error("Damaged ZIP file");
      const method = v.getUint16(p + 10, true),
        csize = v.getUint32(p + 20, true),
        nl = v.getUint16(p + 28, true),
        xl = v.getUint16(p + 30, true),
        cl = v.getUint16(p + 32, true),
        lo = v.getUint32(p + 42, true),
        name = dec.decode(u.subarray(p + 46, p + 46 + nl)),
        start =
          lo + 30 + v.getUint16(lo + 26, true) + v.getUint16(lo + 28, true),
        raw = u.subarray(start, start + csize);
      if (!name.endsWith("/")) {
        if (method == 0) out.set(name, raw);
        else if (method == 8) out.set(name, await inflate(raw));
      }
      p += 46 + nl + xl + cl;
    }
    return out;
  }

  const isZip = (buf) =>
    buf.byteLength >= 4 && new DataView(buf).getUint32(0, true) == 0x04034b50;

  return { make, read, isZip, crc32 };
})();

if (typeof module !== "undefined") module.exports = { Zip };
