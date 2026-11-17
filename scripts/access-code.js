#!/usr/bin/env node
// Make, list and remove access codes for the website.
//   npm run code -- add "Name"        make a new random code (shown once)
//   npm run code -- add "Name" CODE   use your own code
//   npm run code -- list              list the names
//   npm run code -- remove "Name"     the code stops working
//   npm run code -- find REF          which code made a PDF ("Ref ..." in its footer)
// Only a scrambled version of each code is saved, in js/access.js. Write the
// code down when it is shown: it cannot be read back from the file.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { codeHash, normCode, codeRef } = require("../js/utils.js");

const FILE = path.join(__dirname, "../js/access.js");
// Each entry is ["Name", "<64 hex characters>"], on one line or spread over
// several (as a code formatter may leave it).
const read = () => {
  const text = fs.readFileSync(FILE, "utf8"),
    list = [
      ...text.matchAll(
        /\[\s*("(?:[^"\\]|\\.)*")\s*,\s*"([0-9a-f]{64})"\s*,?\s*\]/g,
      ),
    ].map((m) => [JSON.parse(m[1]), m[2]]);
  // Never overwrite codes that could not be read.
  if (list.length != (text.match(/"[0-9a-f]{64}"/g) || []).length)
    throw new Error("Could not read js/access.js. Check its format.");
  return list;
};
const write = (list) =>
  fs.writeFileSync(
    FILE,
    `// Access codes for this website: a code is asked for before the app opens.
// Only scrambled (SHA-256) versions are stored here, never the codes themselves.
// Manage them with scripts/access-code.js (npm run code -- add / list / remove).
// With no codes listed, the app opens without asking.
// This only keeps out casual visitors: the app's code is public.
// prettier-ignore
const ACCESS_CODES = [
${list.map(([n, h]) => `  [${JSON.stringify(n)}, "${h}"],`).join("\n")}
];
`,
  );
// 12 characters without look-alikes (no 0/O, 1/I/L), shown as XXXX-XXXX-XXXX.
const randomCode = () => {
  const A = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = "";
  for (const b of crypto.randomBytes(12)) s += A[b % A.length];
  return s.match(/.{4}/g).join("-");
};

const [cmd, name, own] = process.argv.slice(2);
const list = fs.existsSync(FILE) ? read() : [];
if (cmd == "add" && name) {
  if (list.some(([n]) => n.toLowerCase() == name.toLowerCase()))
    throw new Error(
      `"${name}" already exists. Remove it first or use another name.`,
    );
  const code = own || randomCode();
  if (normCode(code).length < 6)
    throw new Error("Use at least 6 letters or digits.");
  if (list.some(([, h]) => codeRef(h) == codeRef(codeHash(code))))
    throw new Error("That code is already in use.");
  list.push([name, codeHash(code)]);
  write(list);
  console.log(
    `Added "${name}". Access code: ${code}\nWrite it down now: it is not stored anywhere in readable form.`,
  );
} else if (cmd == "remove" && name) {
  const left = list.filter(([n]) => n.toLowerCase() != name.toLowerCase());
  if (left.length == list.length) throw new Error(`No code named "${name}".`);
  write(left);
  console.log(`Removed "${name}". That code no longer opens the app.`);
} else if (cmd == "list") {
  console.log(
    list.length
      ? list.map(([n, h]) => `- ${n}   (PDF ref ${codeRef(h)})`).join("\n")
      : "No access codes: the app opens without asking.",
  );
} else if (cmd == "find" && name) {
  const ref = name
      .replace(/^ref\s*/i, "")
      .trim()
      .toUpperCase(),
    hit = list.find(([, h]) => codeRef(h) == ref);
  console.log(
    hit
      ? `Ref ${ref} = "${hit[0]}".`
      : `No current code has Ref ${ref}. It may belong to a code that was removed.`,
  );
} else {
  console.log(
    'Usage: npm run code -- add "Name" [CODE] | list | remove "Name" | find REF',
  );
  process.exitCode = 1;
}
