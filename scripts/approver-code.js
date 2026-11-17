#!/usr/bin/env node
// Make, list and remove approver codes. An approver enters their code to sign
// an approval; only the matching public key is saved, in js/approvers.js.
//   npm run approver -- add "Name"        make a new random code (shown once)
//   npm run approver -- list              list the names
//   npm run approver -- rename "Old" "New"
//   npm run approver -- remove "Name"     approvals signed with it stop counting
//   npm run approver -- find REF          which approver code signed a PDF
//                                         ("Approver ref ..." hidden in the PDF)
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { apKeys, codeRef } = require("../js/utils.js");

const FILE = path.join(__dirname, "../js/approvers.js");
// Each entry is ["Name", "<64 hex characters>"], on one or more lines.
const read = () => {
  if (!fs.existsSync(FILE)) return [];
  const text = fs.readFileSync(FILE, "utf8"),
    list = [
      ...text.matchAll(
        /\[\s*("(?:[^"\\]|\\.)*")\s*,\s*"([0-9a-f]{64})"\s*,?\s*\]/g,
      ),
    ].map((m) => [JSON.parse(m[1]), m[2]]);
  if (list.length != (text.match(/"[0-9a-f]{64}"/g) || []).length)
    throw new Error("Could not read js/approvers.js. Check its format.");
  return list;
};
const write = (list) =>
  fs.writeFileSync(
    FILE,
    `// Approvers: people who can approve procedures. Each one has a secret
// approver code; only its public key is stored here, so the code cannot be
// worked out from this file and an approval cannot be faked without it.
// Manage with scripts/approver-code.js (npm run approver -- add / list / rename / remove).
// prettier-ignore
const APPROVERS = [
${list.map(([n, h]) => `  [${JSON.stringify(n)}, "${h}"],`).join("\n")}
];
`,
  );
// 16 characters without look-alikes, shown as XXXX-XXXX-XXXX-XXXX (about 79 bits).
const randomCode = () => {
  const A = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = "";
  while (s.length < 16) {
    const b = crypto.randomBytes(1)[0];
    if (b < 248) s += A[b % 31]; // no bias
  }
  return s.match(/.{4}/g).join("-");
};
const find = (list, name) =>
  list.findIndex(([n]) => n.toLowerCase() == String(name).toLowerCase());

(async () => {
  const [cmd, a, b] = process.argv.slice(2),
    list = read();
  if (cmd == "add" && a) {
    if (find(list, a) >= 0) throw new Error(`"${a}" already exists.`);
    const code = randomCode(),
      { pub } = await apKeys(code);
    list.push([a, pub]);
    write(list);
    console.log(
      `Added approver "${a}". Approver code: ${code}\nWrite it down now: it is not stored anywhere in readable form.`,
    );
  } else if (cmd == "rename" && a && b) {
    const i = find(list, a);
    if (i < 0) throw new Error(`No approver named "${a}".`);
    if (find(list, b) >= 0) throw new Error(`"${b}" already exists.`);
    list[i][0] = b;
    write(list);
    console.log(`Renamed "${a}" to "${b}". The approver code stays the same.`);
  } else if (cmd == "remove" && a) {
    const i = find(list, a);
    if (i < 0) throw new Error(`No approver named "${a}".`);
    list.splice(i, 1);
    write(list);
    console.log(
      `Removed "${a}". Approvals signed with that code are no longer accepted.`,
    );
  } else if (cmd == "find" && a) {
    const ref = a
        .replace(/^(approver\s*)?ref\s*/i, "")
        .trim()
        .toUpperCase(),
      hit = list.find(([, h]) => codeRef(h) == ref);
    console.log(
      hit
        ? `Approver ref ${ref} = "${hit[0]}".`
        : `No current approver has ref ${ref}. It may belong to a code that was removed.`,
    );
  } else if (cmd == "list") {
    console.log(
      list.length
        ? list
            .map(([n, h]) => `- ${n}   (approver ref ${codeRef(h)})`)
            .join("\n")
        : "No approvers.",
    );
  } else {
    console.log(
      'Usage: npm run approver -- add "Name" | list | rename "Old" "New" | remove "Name" | find REF',
    );
    process.exitCode = 1;
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
