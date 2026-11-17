// Photo markup: draw arrows, circles and numbers on a photo to point at the
// exact part. Opens over the page (outside #app, so R() does not touch it).
// Marks are drawn at the photo's full resolution and saved into the photo
// (it stays a normal JPEG for the PDF and backups); Undo puts the old photo back.
const MK_COLORS = [
  ["red", "Red", "#e00000"],
  ["yellow", "Yellow", "#ffd400"],
  ["black", "Black", "#000000"],
  ["white", "White", "#ffffff"],
];
const MK_TOOLS = [
  ["arrow", "↗ Arrow"],
  ["circle", "◯ Circle"],
  ["num", "① Number"],
];
// The open editor: { k, i, j, img, shapes, tool, color, drag }
let MK = null;

// The photo a markup button points at: k = "prod" / "pack" (gallery photo i),
// "step" (step i) or "sub" (sub-step j of step i).
const mkGet = (k, i, j) => {
  const p = P();
  return k == "step"
    ? p.steps[i].img
    : k == "sub"
      ? p.steps[i].subs[j].img
      : p[k][i];
};
const mkSet = (k, i, j, v) => {
  const p = P();
  if (k == "step") p.steps[i].img = v;
  else if (k == "sub") p.steps[i].subs[j].img = v;
  else p[k][i] = v;
};
const mkWhere = (k, i, j) =>
  k == "step"
    ? `step ${i + 1}`
    : k == "sub"
      ? `sub-step ${i + 1}.${j + 1}`
      : "the photo";

function openMarkup(k, i, j) {
  const src = mkGet(k, i, j);
  if (!src) return;
  const img = new Image();
  img.onload = () => {
    MK = { k, i, j, img, shapes: [], tool: "arrow", color: "red", drag: null };
    mkUI();
  };
  img.onerror = () => alert(BAD_IMG);
  img.src = src;
}

function mkUI() {
  let el = $("#mk");
  if (!el) {
    el = document.createElement("div");
    el.id = "mk";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-label", "Mark up photo");
    document.body.append(el);
  }
  document.body.classList.add("mkopen");
  el.innerHTML =
    `<div class="mkbar"><div class="mkgrp" role="group" aria-label="Tool">${MK_TOOLS.map(
      ([k, n]) =>
        `<button class="mkb${MK.tool == k ? " on" : ""}" data-mkt="${k}" aria-pressed="${MK.tool == k}">${n}</button>`,
    ).join("")}</div>` +
    `<div class="mkgrp" role="group" aria-label="Colour">${MK_COLORS.map(
      ([k, n, c]) =>
        `<button class="mkc${MK.color == k ? " on" : ""}" data-mkc="${k}" style="background:${c}" aria-label="${n}" aria-pressed="${MK.color == k}" title="${n}"></button>`,
    ).join("")}</div>` +
    `<div class="mkgrp"><button class="mkb" data-mkx="undo">↶ Undo</button><button class="mkb" data-mkx="clear">Clear</button></div>` +
    `<div class="mkgrp mkend"><button class="mkb" data-mkx="cancel">Cancel</button><button class="mkb mks" data-mkx="save">Save</button></div></div>` +
    `<p class="mkhint">${MK.tool == "num" ? "Tap where each number goes: 1, 2, 3…" : MK.tool == "arrow" ? "Drag from the start of the arrow to the point it shows." : "Drag across the part to circle it."}</p>` +
    `<div class="mkwrap"><canvas id="mkc" aria-label="Photo of ${mkWhere(MK.k, MK.i, MK.j)}"></canvas></div>`;
  const c = $("#mkc");
  c.width = MK.img.naturalWidth;
  c.height = MK.img.naturalHeight;
  mkDraw();
  c.addEventListener("pointerdown", mkDown);
  c.addEventListener("pointermove", mkMove);
  c.addEventListener("pointerup", mkUp);
  c.addEventListener("pointercancel", () => ((MK.drag = null), mkDraw()));
  const btn = el.querySelector(".mkb.on") || el.querySelector(".mkb");
  btn.focus();
}

function closeMarkup() {
  MK = null;
  const el = $("#mk");
  if (el) el.remove();
  document.body.classList.remove("mkopen");
}

// Pointer position in photo pixels.
const mkPos = (e) => {
  const c = e.target,
    r = c.getBoundingClientRect();
  return [
    ((e.clientX - r.left) * c.width) / r.width,
    ((e.clientY - r.top) * c.height) / r.height,
  ];
};
function mkDown(e) {
  e.preventDefault();
  const [x, y] = mkPos(e);
  if (MK.tool == "num") {
    const n = MK.shapes.filter((s) => s.t == "num").length + 1;
    MK.shapes.push({ t: "num", x, y, n, c: MK.color });
    mkDraw();
    return;
  }
  e.target.setPointerCapture(e.pointerId);
  MK.drag = { t: MK.tool, x1: x, y1: y, x2: x, y2: y, c: MK.color };
}
function mkMove(e) {
  if (!MK || !MK.drag) return;
  [MK.drag.x2, MK.drag.y2] = mkPos(e);
  mkDraw();
}
function mkUp(e) {
  if (!MK || !MK.drag) return;
  const d = MK.drag,
    c = e.target,
    min = Math.max(c.width, c.height) / 60; // ignore taps and tiny drags
  [d.x2, d.y2] = mkPos(e);
  if (Math.hypot(d.x2 - d.x1, d.y2 - d.y1) > min) MK.shapes.push(d);
  MK.drag = null;
  mkDraw();
}

// Draw the photo and every mark. Marks get a thin contrasting outline so
// they show on light and dark backgrounds.
function mkDraw() {
  const c = $("#mkc");
  if (!c) return;
  const g = c.getContext("2d"),
    u = Math.max(c.width, c.height) / 1000;
  g.drawImage(MK.img, 0, 0);
  const col = (k) => (MK_COLORS.find((x) => x[0] == k) || MK_COLORS[0])[2],
    edge = (k) => (k == "yellow" || k == "white" ? "#000000" : "#ffffff");
  for (const s of MK.drag ? [...MK.shapes, MK.drag] : MK.shapes) {
    g.lineCap = "round";
    g.lineJoin = "round";
    if (s.t == "num") {
      const r = 24 * u;
      g.beginPath();
      g.arc(s.x, s.y, r, 0, 2 * Math.PI);
      g.fillStyle = col(s.c);
      g.fill();
      g.lineWidth = 3 * u;
      g.strokeStyle = edge(s.c);
      g.stroke();
      g.fillStyle = edge(s.c);
      g.font = `bold ${28 * u}px Helvetica, Arial, sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(String(s.n), s.x, s.y + 1 * u);
      continue;
    }
    const path = () => {
      g.beginPath();
      if (s.t == "circle") {
        g.ellipse(
          (s.x1 + s.x2) / 2,
          (s.y1 + s.y2) / 2,
          Math.abs(s.x2 - s.x1) / 2,
          Math.abs(s.y2 - s.y1) / 2,
          0,
          0,
          2 * Math.PI,
        );
      } else {
        const a = Math.atan2(s.y2 - s.y1, s.x2 - s.x1),
          h = 30 * u;
        g.moveTo(s.x1, s.y1);
        g.lineTo(s.x2, s.y2);
        g.moveTo(s.x2 - h * Math.cos(a - 0.45), s.y2 - h * Math.sin(a - 0.45));
        g.lineTo(s.x2, s.y2);
        g.lineTo(s.x2 - h * Math.cos(a + 0.45), s.y2 - h * Math.sin(a + 0.45));
      }
    };
    path();
    g.lineWidth = 11 * u;
    g.strokeStyle = edge(s.c);
    g.stroke();
    path();
    g.lineWidth = 7 * u;
    g.strokeStyle = col(s.c);
    g.stroke();
  }
}

async function saveMarkup() {
  const c = $("#mkc"),
    { k, i, j, shapes } = MK;
  if (!shapes.length) return closeMarkup();
  MK.drag = null;
  mkDraw();
  const old = mkGet(k, i, j),
    data = c.toDataURL("image/jpeg", 0.9);
  remember(`Photo marked up in ${mkWhere(k, i, j)}`);
  mkSet(k, i, j, data);
  if (!(await writeNow())) {
    mkSet(k, i, j, old);
    UNDO.pop();
    return;
  }
  closeMarkup();
  R(true);
}

// The editor's own buttons (not data-a, so the main click handler skips them).
document.addEventListener("click", (e) => {
  if (!MK) return;
  const b = e.target.closest("[data-mkt],[data-mkc],[data-mkx]");
  if (!b) return;
  if (b.dataset.mkt) MK.tool = b.dataset.mkt;
  else if (b.dataset.mkc) MK.color = b.dataset.mkc;
  else if (b.dataset.mkx == "undo") MK.shapes.pop();
  else if (b.dataset.mkx == "clear") MK.shapes = [];
  else if (b.dataset.mkx == "cancel") return closeMarkup();
  else if (b.dataset.mkx == "save") return saveMarkup();
  if (b.dataset.mkt || b.dataset.mkc) {
    const sel = b.dataset.mkt
      ? `[data-mkt="${b.dataset.mkt}"]`
      : `[data-mkc="${b.dataset.mkc}"]`;
    mkUI();
    $(sel).focus();
  } else mkDraw();
});
// Esc cancels; Ctrl+Z removes the last mark while the editor is open.
document.addEventListener(
  "keydown",
  (e) => {
    if (!MK) return;
    if (e.key == "Escape") {
      e.preventDefault();
      closeMarkup();
    } else if (e.key.toLowerCase() == "z" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      e.stopPropagation();
      MK.shapes.pop();
      mkDraw();
    }
  },
  true,
);
