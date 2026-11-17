#!/usr/bin/env node
// Make, list and remove access codes for the website.
//   npm run code -- add "Name"        make a new random code (shown once)
//   npm run code -- add "Name" CODE   use your own code
//   npm run code -- list              list the names
//   npm run code -- remove "Name"     the code stops working
//   npm run code -- find REF          which code made a PDF ("Ref ..." in its footer)
//   npm run code -- dots "0110 ..."   same, from the tracking dots (28 bits)
// Only a scrambled version of each code is saved, in js/access.js. Write the
// code down when it is shown: it cannot be read back from the file.
// Admin codes work the same way with --admin (npm run admin -- add "Name"),
// saved in js/admins.js. Admins can also see the print log.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { codeHash, normCode, codeRef, bitsRef } = require("../js/utils.js");

const ADMIN = process.argv[2] == "--admin";
if (ADMIN) process.argv.splice(2, 1);
const FILE = path.join(
    __dirname,
    ADMIN ? "../js/admins.js" : "../js/access.js",
  ),
  OTHER = path.join(__dirname, ADMIN ? "../js/access.js" : "../js/admins.js");
// Each entry is ["Name", "<64 hex characters>"], on one line or spread over
// several (as a code formatter may leave it).
const read = (file = FILE) => {
  if (!fs.existsSync(file)) return [];
  const text = fs.readFileSync(file, "utf8"),
    list = [
      ...text.matchAll(
        /\[\s*("(?:[^"\\]|\\.)*")\s*,\s*"([0-9a-f]{64})"\s*,?\s*\]/g,
      ),
    ].map((m) => [JSON.parse(m[1]), m[2]]);
  // Never overwrite codes that could not be read.
  if (list.length != (text.match(/"[0-9a-f]{64}"/g) || []).length)
    throw new Error(`Could not read ${path.basename(file)}. Check its format.`);
  return list;
};
const write = (list) =>
  fs.writeFileSync(
    FILE,
    (ADMIN
      ? `// Admin codes: log in like an access code, and can also see the print log
// and clear all data. Only scrambled (SHA-256) versions are stored here.
// Manage them with scripts/access-code.js (npm run admin -- add / list / remove).
// prettier-ignore
const ADMIN_CODES = [`
      : `// Access codes for authors: a code is asked for when the app opens (log in).
// Only scrambled (SHA-256) versions are stored here, never the codes themselves.
// Manage them with scripts/access-code.js (npm run code -- add / list / remove).
// With no access, admin or approver codes listed, the app opens without asking.
// This only keeps out casual visitors: the app's code is public.
// prettier-ignore
const ACCESS_CODES = [`) +
      `
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
  if (
    [...list, ...read(OTHER)].some(
      ([, h]) => codeRef(h) == codeRef(codeHash(code)),
    )
  )
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
} else if ((cmd == "find" || cmd == "dots") && name) {
  const ref =
      cmd == "dots"
        ? bitsRef(process.argv.slice(3).join(""))
        : name
            .replace(/^ref\s*/i, "")
            .trim()
            .toUpperCase(),
    hit = list.find(([, h]) => codeRef(h) == ref);
  if (!ref) {
    console.log(
      "Those dots do not make a valid reference: there must be 28, and the check digit must match. Read them again.",
    );
    process.exit(1);
  }
  console.log(
    hit
      ? `Ref ${ref} = "${hit[0]}".`
      : `No current code has Ref ${ref}. It may belong to a code that was removed.`,
  );
} else {
  console.log(
    'Usage: npm run code -- add "Name" [CODE] | list | remove "Name" | find REF | dots "0110 ..."',
  );
  process.exitCode = 1;
}
