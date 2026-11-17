// Approvers: people who can approve procedures. Each one has a secret
// approver code; only its public key is stored here, so the code cannot be
// worked out from this file and an approval cannot be faked without it.
// Manage with scripts/approver-code.js (npm run approver -- add / list / rename / remove).
// prettier-ignore
const APPROVERS = [
  ["Approver 1", "06db6869c1c934c5a53e4d02768ff19f3846825807bad28c486cd6fc0111ca9e"],
  ["Approver 2", "7e0916168423de8b1cafdb242356008926d14064e1f6bbb48169349114352824"],
  ["Approver 3", "690c9e4c2f97751665f1923ff7911b0f58cf7b2b49581d7a4a273b9f084d33b6"],
  ["Approver 4", "e00d3d1e982d956567eca07d9b030a31f2548190fdca3c3e3b00925c80200aaf"],
  ["Approver 5", "2ffa1c777a63b38d0c6ae81fdce05c8b46e7e854b244ae13d27068f3b7bc6ff2"],
  ["Approver 6", "a4a5f6f6a4f2b1c97d397660365274b3c2acb6be3d2e534943c83a08291e012d"],
  ["Approver 7", "504ac6c1b5efc8e694a243807bacd67faef1bcdb1113e8bd8b79210c3fd371cf"],
  ["Approver 8", "a20c59389fce9152a644e9b506286bfec6d7ef95f7d9bc9ccecd45b2598e23db"],
  ["Approver 9", "db4357eb5f942f50b942a4820e77ca44409bbaf82c6504da47041afafdcf45c3"],
  ["Approver 10", "ee7c9715f4341fb73b0341b71bfb364f3d8bab876221219e628d0034e9872d75"],
];
