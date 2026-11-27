// PDF export (jsPDF): watermark, photo sizes and the procedure layout.
// ---------- PDF watermark ----------

// Watermark text for a product or machine: [company name, department].
// Empty parts are left out.
const wmLines = (p) =>
  [S.co.name, deptName(deptOf(p, S.co), S.co)]
    .map((x) => String(x || "").trim())
    .filter(Boolean);

// The "Add watermark" tick box shown above Download PDF.
// Largest printed size (mm) of photos in the PDF. Photos keep their shape and
// full resolution, so they stay sharp when the PDF is zoomed.
const PHOTO_SIZES = {
  small: { label: "Small", step: [70, 52], sub: [56, 42], gal: [44, 34] },
  medium: { label: "Medium", step: [85, 64], sub: [68, 51], gal: [54, 42] },
  large: { label: "Large", step: [100, 75], sub: [80, 60], gal: [64, 50] },
};
const psBox = () =>
  `<label class="chk"><span>Photo size in the PDF</span><select data-ps="1" aria-label="Photo size in the PDF">${Object.entries(
    PHOTO_SIZES,
  )
    .map(
      ([k, v]) =>
        `<option value="${k}"${k == PS ? " selected" : ""}>${v.label}</option>`,
    )
    .join("")}</select></label>`;

const wmBox = (p) => {
  const lines = wmLines(p);
  return `<label class="chk"><input type="checkbox" data-wm="1"${WM && lines.length ? " checked" : ""}${lines.length ? "" : " disabled"}> <span>Add watermark to the PDF${lines.length ? `: <b>${lines.map(esc).join(" · ")}</b>` : " (enter a company name first)"}</span></label>`;
};

// Large, faint diagonal text across the middle of a page: the company name,
// and the department on a second, smaller line. Drawn over the content so it
// also shows on photos, but light enough to read through.
function watermark(d, lines, W, H) {
  const ang = (Math.atan2(H, W) * 180) / Math.PI, // corner to corner
    rad = (ang * Math.PI) / 180,
    dir = [Math.cos(rad), -Math.sin(rad)], // along the text (jsPDF y points down)
    up = [-Math.sin(rad), -Math.cos(rad)], // towards the top of the letters
    maxW = Math.hypot(W, H) * 0.72,
    sizes = [];
  d.setFont("helvetica", "bold");
  lines.forEach((t, i) => {
    const want = i == 0 ? 64 : 36;
    d.setFontSize(want);
    const w = d.getTextWidth(t.toUpperCase());
    sizes.push(Math.max(10, Math.min(want, (want * maxW) / w)));
  });
  let gs = false;
  try {
    d.saveGraphicsState();
    d.setGState(new d.GState({ opacity: 0.13 }));
    gs = true;
  } catch (e) {}
  d.setTextColor(...(gs ? [0, 0, 0] : [225, 225, 225]));
  // Stack the lines around the page centre.
  const pt = 0.3528, // mm per point
    hts = sizes.map((s) => s * pt),
    gap = 4,
    total = hts.reduce((a, h) => a + h, 0) + gap * (lines.length - 1);
  let off = total / 2; // distance of the next line's top above the centre
  lines.forEach((t, i) => {
    const txt = t.toUpperCase();
    d.setFontSize(sizes[i]);
    const w = d.getTextWidth(txt),
      base = off - hts[i] * 0.78, // baseline below the line's top
      cx = W / 2 + up[0] * base,
      cy = H / 2 + up[1] * base;
    d.text(txt, cx - (dir[0] * w) / 2, cy - (dir[1] * w) / 2, { angle: ang });
    off -= hts[i] + gap;
  });
  if (gs) d.restoreGraphicsState();
  d.setFont("helvetica", "normal");
}

// Tracking dots: the reference (refBits in utils.js) as a row of tiny grey
// dots, one per bit: a dot in the upper row = 0, in the lower row = 1. Each
// end has a dot in both rows, and the bits come in groups of 4 with a wider
// gap. Read with a magnifier, then: npm run code -- dots "0110 1010 ...".
function refDots(d, ref, cx, y) {
  const bits = refBits(ref);
  if (!bits.length) return;
  const step = 0.9,
    gap = 0.9, // extra space between groups of 4
    row = 0.9, // distance between the upper and lower row
    r = 0.22,
    width = (bits.length + 3) * step + 6 * gap,
    pos = [];
  let x = cx - width / 2;
  pos.push([x, 2]); // start: both rows
  x += step * 1.5;
  bits.forEach((b, i) => {
    if (i && i % 4 == 0) x += gap;
    pos.push([x, b]);
    x += step;
  });
  pos.push([x + step * 0.5, 2]); // end: both rows
  d.setFillColor(150, 150, 150);
  for (const [px, b] of pos) {
    if (b != 1) d.circle(px, y, r, "F");
    if (b != 0) d.circle(px, y + row, r, "F");
  }
}

// "DRAFT" in large, faint red letters from the top left to the bottom right
// of the page (crossing the company watermark, which runs the other way).
function draftMark(d, W, H) {
  const ang = (-Math.atan2(H, W) * 180) / Math.PI,
    rad = (ang * Math.PI) / 180,
    dir = [Math.cos(rad), -Math.sin(rad)],
    up = [-Math.sin(rad), -Math.cos(rad)],
    size = 120;
  d.setFont("helvetica", "bold");
  d.setFontSize(size);
  const w = d.getTextWidth("DRAFT"),
    base = -size * 0.3528 * 0.36; // baseline below the centre
  let gs = false;
  try {
    d.saveGraphicsState();
    d.setGState(new d.GState({ opacity: 0.14 }));
    gs = true;
  } catch (e) {}
  d.setTextColor(...(gs ? [200, 0, 0] : [250, 215, 215]));
  d.text(
    "DRAFT",
    W / 2 + up[0] * base - (dir[0] * w) / 2,
    H / 2 + up[1] * base - (dir[1] * w) / 2,
    { angle: ang },
  );
  if (gs) d.restoreGraphicsState();
  d.setFont("helvetica", "normal");
}

// PDF of the product/machine being edited, or (for an approver reviewing a
// request) of o = { p, mm, line, coName, dept, logo, review: true }.
// Only an approval whose signature and content check out prints the
// approver's name; anything else is a DRAFT.
// With o.batch (several PDFs at once) it returns { file, blob } instead of
// downloading, and is logged like a normal PDF.
async function mkPdf(o) {
  const batch = !!(o && o.batch),
    own = !o || batch;
  if (!o && !String(P().by || "").trim()) {
    alert('Enter "Prepared by" before downloading.');
    return;
  }
  const c = o || {
      p: P(),
      mm: T == "m",
      line: T == "m" ? "" : L().name,
      coName: S.co.name,
      dept: deptName(deptOf(P(), S.co), S.co),
      logo: S.logo,
    },
    p = c.p,
    mm = c.mm,
    ap = own ? await apState(p, mm ? "machine" : "product") : { st: "review" },
    approved = ap.st == "approved";
  const d = new window.jspdf.jsPDF({ unit: "mm", format: "a4" }),
    W = 210,
    M = 18,
    B = 275,
    CW = W - 2 * M;
  let y = M;
  const G = [110, 110, 110],
    K = [0, 0, 0],
    LN = [200, 200, 200];
  const tc = (c) => d.setTextColor(c[0], c[1], c[2]);
  const need = (h) => {
    if (y + h > B) {
      d.addPage();
      y = M + 4;
    }
  };
  const fit = (s, mw, mh) => {
    const q = d.getImageProperties(s);
    let w = mw,
      h = (w * q.height) / q.width;
    if (h > mh) {
      h = mh;
      w = (h * q.width) / q.height;
    }
    return [w, h];
  };
  const sec = (t) => {
    need(16);
    y += 5;
    d.setFont("helvetica", "bold");
    d.setFontSize(11);
    tc(K);
    d.text(t, M, y);
    y += 2.5;
    d.setDrawColor(...LN);
    d.setLineWidth(0.2);
    d.line(M, y, W - M, y);
    y += 5;
  };
  const para = (t, x, w, sz, bd, col) => {
    d.setFont("helvetica", bd ? "bold" : "normal");
    d.setFontSize(sz);
    tc(col || K);
    const lh = sz * 0.46;
    for (const l of d.splitTextToSize(t, w)) {
      need(lh + 1);
      d.text(l, x, y + lh * 0.8);
      y += lh;
    }
  };
  const box = (s, x, w, h) => {
    d.addImage(s, "JPEG", x, y, w, h);
    d.setDrawColor(...LN);
    d.setLineWidth(0.2);
    d.rect(x, y, w, h);
  };
  const PH = PHOTO_SIZES[PS] || PHOTO_SIZES.medium;
  const gal = (arr) => {
    let x = M,
      rh = 0;
    for (const s of arr) {
      const [w, h] = fit(s, ...PH.gal);
      if (x + w > W - M + 0.1) {
        x = M;
        y += rh + 4;
        rh = 0;
      }
      if (y + h > B) {
        d.addPage();
        y = M + 4;
        x = M;
        rh = 0;
      }
      box(s, x, w, h);
      x += w + 5;
      rh = Math.max(rh, h);
    }
    y += rh + 4;
  };
  d.setFont("helvetica", "normal");
  d.setFontSize(9);
  tc(G);
  // Company logo at the top right; the title wraps before reaching it.
  let lw = 0,
    lh = 0;
  if (c.logo) {
    [lw, lh] = fit(c.logo, 45, 18);
    d.addImage(c.logo, "PNG", W - M - lw, M, lw, lh);
  }
  // Top line: company · department · Setup procedure
  const top = [c.coName, c.dept, "Setup procedure"]
    .map((x) => String(x || "").trim())
    .filter(Boolean)
    .join("  ·  ");
  d.text(d.splitTextToSize(top, CW - (lw ? lw + 6 : 0))[0], M, y + 3);
  y += 8;
  para(p.name || "Untitled", M, CW - (lw ? lw + 6 : 0), 20, 1);
  y = Math.max(y + 4, M + lh + 4);
  const meta = [
      mm ? ["Type", "Machine"] : ["Line", c.line],
      [mm ? "Asset ID" : "Product code", p.code || "-"],
      ["Revision", p.rev || "-"],
      ["Date", p.date || "-"],
    ],
    cw = CW / 4;
  meta.forEach(([k, v], i) => {
    const x = M + i * cw;
    d.setFont("helvetica", "normal");
    d.setFontSize(8);
    tc(G);
    d.text(k, x, y + 3);
    d.setFont("helvetica", "bold");
    d.setFontSize(10);
    tc(K);
    d.text(d.splitTextToSize(String(v), cw - 4)[0], x, y + 8.5);
  });
  y += 13;
  d.setDrawColor(...K);
  d.setLineWidth(0.5);
  d.line(M, y, W - M, y);
  y += 1;
  // Safety equipment: a row of safety signs with their names, then any
  // other equipment as text.
  const ppe = ppeOf(p),
    ppeo = String(p.ppeo || "").trim();
  if (ppe.length || ppeo) {
    sec("Safety equipment required");
    const pngs = await Promise.all(ppe.map(ppePng)),
      sz = 14,
      cell = 26,
      per = Math.max(1, Math.floor(CW / cell));
    ppe.forEach((x, i) => {
      const col = i % per;
      if (col == 0 && i) y += sz + 10;
      if (col == 0) need(sz + 10);
      const cx = M + col * cell + cell / 2;
      if (pngs[i]) d.addImage(pngs[i], "PNG", cx - sz / 2, y, sz, sz);
      else {
        d.setFillColor(31, 90, 166);
        d.circle(cx, y + sz / 2, sz / 2, "F");
      }
      d.setFont("helvetica", "bold");
      d.setFontSize(7.5);
      tc(K);
      d.text(d.splitTextToSize(x.n, cell - 2).slice(0, 2), cx, y + sz + 3.6, {
        align: "center",
      });
    });
    if (ppe.length) y += sz + 10;
    if (ppeo) {
      para("Also required: " + ppeo, M, CW, 10, 0);
      y += 2;
    }
  }
  if (p.prod.length) {
    sec(mm ? "Machine photos" : "Product photos");
    gal(p.prod);
  }
  if (p.pack.length) {
    sec(mm ? "Control panel / nameplate photos" : "Packaging photos");
    gal(p.pack);
  }
  // Tools required: a table with an empty box to tick for each tool.
  const tools = (p.tools || []).filter((t) => String(t.n || "").trim());
  if (tools.length) {
    sec("Tools required");
    const cols = [CW - 74, 60, 14],
      heads = ["Tool", "Size / specification", "Ready"],
      hh = 8;
    const header = () => {
      let x = M;
      d.setDrawColor(...K);
      d.setLineWidth(0.3);
      d.setFont("helvetica", "bold");
      d.setFontSize(9);
      tc(K);
      heads.forEach((t, c) => {
        d.rect(x, y, cols[c], hh);
        d.text(t, x + 2, y + 5.4);
        x += cols[c];
      });
      y += hh;
    };
    need(hh + 9 + 2);
    header();
    tools.forEach((t) => {
      d.setFont("helvetica", "normal");
      d.setFontSize(10);
      const a = d.splitTextToSize(String(t.n).trim(), cols[0] - 4),
        b = d.splitTextToSize(String(t.s || "").trim(), cols[1] - 4),
        rh = Math.max(9, Math.max(a.length, b.length || 1) * 4.6 + 4.4);
      if (y + rh > B) {
        d.addPage();
        y = M + 4;
        header();
      }
      let x = M;
      d.setDrawColor(...K);
      d.setLineWidth(0.3);
      cols.forEach((w) => {
        d.rect(x, y, w, rh);
        x += w;
      });
      d.setFont("helvetica", "normal");
      d.setFontSize(10);
      tc(K);
      a.forEach((l, k) => d.text(l, M + 2, y + 5.8 + k * 4.6));
      b.forEach((l, k) => d.text(l, M + cols[0] + 2, y + 5.8 + k * 4.6));
      // empty box to tick by pen
      const bx = M + cols[0] + cols[1] + (cols[2] - 5) / 2;
      d.setLineWidth(0.4);
      d.rect(bx, y + (rh - 5) / 2, 5, 5);
      y += rh;
    });
    y += 4;
  }
  // Machine settings: Parameter | Value | Unit.
  const sets = settingsOf(p);
  if (sets.length) {
    sec("Machine settings");
    const cols = [CW - 75, 50, 25],
      heads = ["Parameter", "Value", "Unit"],
      hh = 8;
    const header = () => {
      let x = M;
      d.setDrawColor(...K);
      d.setLineWidth(0.3);
      d.setFont("helvetica", "bold");
      d.setFontSize(9);
      tc(K);
      heads.forEach((t, c) => {
        d.rect(x, y, cols[c], hh);
        d.text(t, x + 2, y + 5.4);
        x += cols[c];
      });
      y += hh;
    };
    need(hh + 9 + 2);
    header();
    sets.forEach((r) => {
      d.setFont("helvetica", "normal");
      d.setFontSize(10);
      const cells = [r.n, r.v, r.u].map((v, c) =>
          d.splitTextToSize(String(v || "").trim(), cols[c] - 4),
        ),
        rh = Math.max(
          9,
          Math.max(...cells.map((x) => x.length || 1)) * 4.6 + 4.4,
        );
      if (y + rh > B) {
        d.addPage();
        y = M + 4;
        header();
      }
      let x = M;
      d.setDrawColor(...K);
      d.setLineWidth(0.3);
      tc(K);
      cells.forEach((lines, c) => {
        d.rect(x, y, cols[c], rh);
        d.setFont("helvetica", c == 1 ? "bold" : "normal");
        lines.forEach((l, k) => d.text(l, x + 2, y + 5.8 + k * 4.6));
        x += cols[c];
      });
      y += rh;
    });
    y += 4;
  }
  // Height of wrapped text, matching para() below.
  const textH = (t, w, sz, bd) => {
    d.setFont("helvetica", bd ? "bold" : "normal");
    d.setFontSize(sz);
    return d.splitTextToSize(t, w).length * sz * 0.46;
  };
  // Warning / Caution / Note box: coloured edge, symbol and label (same colours
  // as on the page), description in black next to the symbol.
  const NOTE_PDF = {
    warning: { label: "WARNING", rgb: [176, 0, 32] },
    caution: { label: "CAUTION", rgb: [180, 83, 9] },
    note: { label: "NOTE", rgb: [29, 78, 216] },
  };
  const noteBoxH = (txt, w) =>
    Math.max(14, 5.2 + textH(txt, w - 21, 10.5, 0) + 6);
  const drawNote = (type, txt, bx, w) => {
    const c = NOTE_PDF[type] || NOTE_PDF.warning,
      h = noteBoxH(txt, w);
    need(h + 2);
    const by = y,
      ix = bx + 4,
      iy = by + 3,
      sz = 9;
    d.setDrawColor(...c.rgb);
    d.setLineWidth(0.8);
    d.rect(bx, by, w, h);
    d.setLineWidth(0.6);
    d.setFont("helvetica", "bold");
    d.setFontSize(10);
    tc(c.rgb);
    if (type == "note") {
      d.circle(ix + sz / 2, iy + sz / 2, sz / 2 - 0.3, "S");
      d.text("i", ix + sz / 2, iy + sz / 2 + 1.7, { align: "center" });
    } else {
      d.setLineJoin("round");
      d.triangle(
        ix + sz / 2,
        iy,
        ix,
        iy + sz * 0.87,
        ix + sz,
        iy + sz * 0.87,
        "S",
      );
      d.setLineJoin("miter");
      d.text("!", ix + sz / 2, iy + sz * 0.87 - 1.3, { align: "center" });
    }
    y = by + 3;
    d.setFontSize(10.5);
    d.text(c.label, bx + 18, y + 3.9);
    y += 5.2;
    para(txt, bx + 18, w - 21, 10.5, 0, K);
    d.setDrawColor(...K);
    y = by + h + 2;
  };
  // Photos of a step or sub-step, side by side, wrapping into rows. One photo
  // is printed at its full size [mw, mh]; with more, each is at most half the
  // width available (aw), so two fit in a row. -> rows: [[s, w, h]], height.
  const picRows = (o, aw, mw, mh) => {
    const list = photosOf(o),
      gap = 4,
      cw = list.length > 1 ? Math.min(mw, (aw - gap) / 2) : mw,
      ch = list.length > 1 ? Math.min(mh, (cw * mh) / mw) : mh,
      rows = [];
    let row = [],
      x = 0;
    for (const s of list) {
      const [w, h] = fit(s, cw, ch);
      if (row.length && x + w > aw + 0.1) {
        rows.push(row);
        row = [];
        x = 0;
      }
      row.push([s, w, h]);
      x += w + gap;
    }
    if (row.length) rows.push(row);
    const rh = (r) => Math.max(...r.map((q) => q[2]));
    return {
      rows,
      rh,
      h: rows.reduce((a, r) => a + 2 + rh(r), 0),
    };
  };
  // Draw them at x (rows that do not fit move to the next page).
  const pics = (pr, x) => {
    for (const r of pr.rows) {
      y += 2;
      const h = pr.rh(r);
      need(h + 1);
      let cx = x;
      for (const [s, w, ph] of r) {
        box(s, cx, w, ph);
        cx += w + 4;
      }
      y += h;
    }
  };
  // Height of a sub-step and of a whole step (with its notes, photos and
  // sub-steps), used to keep them together on one page where they fit.
  const subH = (u) =>
    Math.max(
      (String(u.warn || "").trim()
        ? noteBoxH(String(u.warn).trim(), CW - 21) + 3
        : 0) +
        (u.t ? textH(u.t, CW - 21, 10.5, 0) : 0) +
        picRows(u, CW - 21, ...PH.sub).h,
      5,
    );
  const stepH = (s) => {
    let sh = 0;
    if (s.h) sh += textH(s.h, CW - 9, 11.5, 1) + 1;
    const warn = String(s.warn || "").trim();
    if (warn) sh += noteBoxH(warn, CW - 9) + 3;
    if (s.t) sh += textH(s.t, CW - 9, 10.5, 0);
    sh += picRows(s, CW - 9, ...PH.step).h;
    (s.subs || []).forEach((u) => (sh += 3 + subH(u)));
    return Math.max(sh, 7);
  };
  // The "Procedure" heading moves to the next page together with step 1.
  const fitsPage = (h) => (h <= B - (M + 4) - 16 ? h : 16);
  need(16 + (p.steps.length ? fitsPage(stepH(p.steps[0])) : 0));
  sec("Procedure");
  p.steps.forEach((s, i) => {
    // Keep a step's headline, notes, text, photos and sub-steps together on one
    // page when they fit on a page; otherwise start it on a new page if it is
    // near the bottom.
    const warn = String(s.warn || "").trim(),
      sh = stepH(s);
    need(sh <= B - (M + 4) ? sh : 16);
    const y0 = y,
      pg = d.getNumberOfPages();
    d.setFont("helvetica", "bold");
    d.setFontSize(12);
    tc(K);
    d.text(i + 1 + ".", M, y + 4.5);
    if (s.h) {
      para(s.h, M + 9, CW - 9, 11.5, 1);
      y += 1;
    }
    if (warn) {
      y += 1;
      drawNote(noteType(s), warn, M + 9, CW - 9);
    }
    if (s.t) para(s.t, M + 9, CW - 9, 10.5, 0, [45, 45, 45]);
    pics(picRows(s, CW - 9, ...PH.step), M + 9);
    // Sub-steps: numbered 3.1, 3.2 … and indented under the step.
    (s.subs || []).forEach((u, j) => {
      y += 3;
      const uh = subH(u);
      need(Math.min(uh, B - (M + 4)));
      const sy = y,
        spg = d.getNumberOfPages();
      d.setFont("helvetica", "bold");
      d.setFontSize(10.5);
      tc(K);
      d.text(`${i + 1}.${j + 1}`, M + 9, y + 3.9);
      const uw = String(u.warn || "").trim();
      if (uw) drawNote(noteType(u), uw, M + 21, CW - 21);
      if (u.t) para(u.t, M + 21, CW - 21, 10.5, 0, [45, 45, 45]);
      pics(picRows(u, CW - 21, ...PH.sub), M + 21);
      if (d.getNumberOfPages() == spg && y < sy + 5) y = sy + 5;
    });
    // Minimum step height, only if the step did not run onto a new page.
    if (d.getNumberOfPages() == pg && y < y0 + 7) y = y0 + 7;
    y += 6;
  });
  y += 4;
  need(88);
  y += 4;
  sec("Approval");
  // Time and technicians table: values printed when entered, otherwise the
  // cell is left blank to write in by pen ("h" and "min" guides for time).
  const mins = toMinutes(p.th, p.tm),
    tech = String(p.tech ?? "").trim(),
    tw = CW / 2,
    th = 8,
    tv = 12;
  d.setDrawColor(...K);
  d.setLineWidth(0.3);
  [
    ["Time required", mins == null ? "" : fmtTime(mins), true],
    ["Technicians required", tech, false],
  ].forEach(([lb, v, isTime], i) => {
    const x = M + i * tw;
    d.rect(x, y, tw, th);
    d.rect(x, y + th, tw, tv);
    d.setFont("helvetica", "bold");
    d.setFontSize(9);
    tc(K);
    d.text(lb, x + 2, y + 5.4);
    if (v) {
      d.setFontSize(12);
      d.text(v, x + 2, y + th + 7.8);
    } else if (isTime) {
      d.setFont("helvetica", "normal");
      d.setFontSize(9);
      tc(G);
      d.text("h", x + 26, y + th + tv - 3);
      d.text("min", x + 58, y + th + tv - 3);
    }
  });
  y += th + tv + 8;
  const c2 = (CW - 10) / 2;
  [
    ["Prepared by", p.by, M],
    ["Approved by", approved ? ap.name : "", M + c2 + 10],
  ].forEach(([lb, nm, x]) => {
    d.setFont("helvetica", "normal");
    d.setFontSize(8);
    tc(G);
    d.text(lb, x, y + 3);
    d.setFont("helvetica", "bold");
    d.setFontSize(12);
    tc(K);
    d.text(d.splitTextToSize(String(nm || ""), c2)[0], x, y + 10);
    if (lb == "Approved by") {
      d.setFont("helvetica", "normal");
      d.setFontSize(8);
      tc(approved ? G : [200, 0, 0]);
      d.text(
        approved
          ? `Approved ${logTime(ap.at)} · digital signature checked`
          : "Not approved: draft",
        x,
        y + 15,
      );
      // Which approver code signed it: hidden text, like the author's reference.
      if (approved)
        d.text("Approver ref " + ap.aref, x, y + 19, {
          renderingMode: "invisible",
        });
    }
    d.setDrawColor(...K);
    d.setLineWidth(0.3);
    d.line(x, y + 24, x + c2, y + 24);
    d.setFont("helvetica", "normal");
    d.setFontSize(8);
    tc(G);
    d.text("Signature", x, y + 28);
    d.text("Date", x + c2 * 0.65, y + 28);
  });
  y += 36;
  // Which access code made this PDF: a short reference in the file's
  // properties, hidden text and tracking dots (never printed as text).
  // Look it up with: npm run code -- find REF.
  const ref = accessRef(),
    now = new Date(),
    printed =
      now.toISOString().slice(0, 10) + " " + now.toTimeString().slice(0, 5);
  d.setProperties({
    title: (p.name || "Setup procedure") + " Rev " + (p.rev || "-"),
    subject: "Setup procedure",
    author: c.coName || "",
    creator: "Setup Procedures",
    keywords:
      (ref ? "Ref " + ref + ", " : "") +
      "printed " +
      printed +
      (approved ? ", approver ref " + ap.aref : ""),
  });
  const n = d.getNumberOfPages(),
    wm = WM
      ? [c.coName, c.dept].map((x) => String(x || "").trim()).filter(Boolean)
      : [];
  for (let i = 1; i <= n; i++) {
    d.setPage(i);
    if (wm.length) watermark(d, wm, W, 297);
    if (!approved) draftMark(d, W, 297);
    // Hidden text: not visible or printed, but found by searching the PDF.
    const hidden = [
      ref && `Ref ${ref} printed ${printed}`,
      approved && `Approver ref ${ap.aref}`,
    ]
      .filter(Boolean)
      .join(" · ");
    if (hidden) {
      d.setFont("helvetica", "normal");
      d.setFontSize(6);
      for (const hy of [10, 150])
        d.text(hidden, M, hy, { renderingMode: "invisible" });
    }
    if (ref) {
      // Tracking dots at the top and bottom of every page.
      refDots(d, ref, W / 2, 7);
      refDots(d, ref, W / 2, 291.6);
    }
    d.setDrawColor(...LN);
    d.setLineWidth(0.2);
    d.line(M, 284, W - M, 284);
    d.setFont("helvetica", "normal");
    d.setFontSize(8);
    tc(G);
    d.text(
      (p.name || "") +
        "  Rev " +
        (p.rev || "-") +
        (approved ? "" : c.review ? "  ·  FOR REVIEW (DRAFT)" : "  ·  DRAFT"),
      M,
      289,
    );
    d.text("Page " + i + " of " + n, W - M, 289, { align: "right" });
  }
  const file =
    (c.review ? "REVIEW_" : "") +
    (p.name || "setup-procedure").replace(/[^\w-]+/g, "_") +
    "_rev" +
    (p.rev || "1") +
    ".pdf";
  const blob = d.output("blob");
  if (own) logPdf(p, file, n, ref, approved ? "Approved" : "Draft", mm, c.line);
  if (batch) return { file, blob };
  await dl(file, blob);
  toast(`PDF saved: ${file}`, false);
}

// PDFs of several products or machines in one .zip. list: [{ p, mm, line }].
async function pdfZip(list, name, btn) {
  const label = btn.textContent,
    files = [],
    used = new Set();
  btn.disabled = true;
  try {
    for (const [k, x] of list.entries()) {
      btn.textContent = `Making PDFs… ${k + 1} of ${list.length}`;
      const r = await mkPdf({
        ...x,
        coName: S.co.name,
        dept: deptName(deptOf(x.p, S.co), S.co),
        logo: S.logo,
        batch: true,
      });
      let f = r.file,
        n = 2;
      while (used.has(f.toLowerCase()))
        f = r.file.replace(/\.pdf$/, `_${n++}.pdf`);
      used.add(f.toLowerCase());
      files.push({ name: f, data: new Uint8Array(await r.blob.arrayBuffer()) });
    }
    await dl(name, Zip.make(files));
    logAct(
      "data",
      `Downloaded ${count(files.length, "PDF", "PDFs")} in "${name}"`,
    );
    toast(`Saved ${count(files.length, "PDF", "PDFs")}: ${name}`, false);
  } catch (e) {
    alert("Could not make the PDFs. Reload the page and try again.");
  } finally {
    btn.disabled = false;
    btn.textContent = label;
  }
}
