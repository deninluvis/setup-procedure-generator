// Safety equipment (PPE). Each product or machine can tick the equipment
// needed: p.ppe = ["glasses", "gloves", ...] plus optional free text p.ppeo.
// The pictograms (white on a blue circle, like mandatory safety signs) are
// drawn here as SVG: shown on the page, and turned into PNG for the PDF.
const PPE_BLUE = "#1f5aa6";
const PPE = [
  {
    k: "glasses",
    n: "Safety glasses",
    svg: `<rect x="17" y="40" width="29" height="21" rx="9"/><rect x="54" y="40" width="29" height="21" rx="9"/><path d="M45 47q5-6 10 0" fill="none" stroke="#fff" stroke-width="5"/><path d="M18 45L10 40M82 45L90 40" stroke="#fff" stroke-width="5" stroke-linecap="round"/>`,
  },
  {
    k: "gloves",
    n: "Gloves",
    svg: `<rect x="31" y="22" width="8" height="34" rx="4"/><rect x="40.5" y="17" width="8" height="38" rx="4"/><rect x="50" y="18" width="8" height="38" rx="4"/><rect x="59.5" y="24" width="8" height="32" rx="4"/><rect x="31" y="44" width="36.5" height="30" rx="8"/><rect x="62" y="44" width="9" height="24" rx="4.5" transform="rotate(35 66 56)"/><rect x="33" y="76" width="33" height="10" rx="2"/>`,
  },
  {
    k: "ear",
    n: "Ear protection",
    svg: `<path d="M27 58V48a23 23 0 0 1 46 0v10" fill="none" stroke="#fff" stroke-width="7"/><rect x="17" y="50" width="17" height="28" rx="7"/><rect x="66" y="50" width="17" height="28" rx="7"/>`,
  },
  {
    k: "shoes",
    n: "Safety shoes",
    svg: `<path d="M29 22h23v33l19 8c8 3 11 7 11 13v2H29z"/><rect x="27" y="81" width="57" height="7" rx="2"/>`,
  },
  {
    k: "helmet",
    n: "Hard hat",
    svg: `<path d="M23 63a27 27 0 0 1 54 0z"/><rect x="45" y="30" width="10" height="20" rx="3" fill="${PPE_BLUE}"/><rect x="14" y="64" width="72" height="9" rx="4.5"/>`,
  },
  {
    k: "vest",
    n: "Hi-vis vest",
    svg: `<path d="M35 18h9l6 19 6-19h9l11 13-2 53H26l-2-53z"/><rect x="25" y="55" width="50" height="5" fill="${PPE_BLUE}"/><rect x="25" y="67" width="50" height="5" fill="${PPE_BLUE}"/><path d="M50 37v47" stroke="${PPE_BLUE}" stroke-width="3"/>`,
  },
  {
    k: "face",
    n: "Face shield",
    svg: `<rect x="25" y="20" width="50" height="10" rx="4"/><path d="M24 33h52l-5 42c-14 9-28 9-42 0z" opacity=".9"/><path d="M36 50h28" stroke="${PPE_BLUE}" stroke-width="4" stroke-linecap="round"/>`,
  },
  {
    k: "mask",
    n: "Dust mask",
    svg: `<path d="M27 47c15-14 31-14 46 0l-4 21c-12 15-26 15-38 0z"/><path d="M28 50L13 42M72 50l15-8M30 62l-15 6M70 62l15 6" stroke="#fff" stroke-width="4" stroke-linecap="round"/><circle cx="50" cy="60" r="7" fill="${PPE_BLUE}"/>`,
  },
];
const PPE_BY_KEY = Object.fromEntries(PPE.map((x) => [x.k, x]));

// The ticked equipment of an item, in the fixed order above.
const ppeOf = (p) => PPE.filter((x) => (p.ppe || []).includes(x.k));

const ppeSvg = (x) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="49" fill="${PPE_BLUE}"/><g fill="#fff">${x.svg}</g></svg>`;

// "Safety equipment" section on the product/machine page.
function ppeHtml(p) {
  const on = new Set(p.ppe || []);
  return (
    `<p class="m">Tick what must be worn. It prints as safety signs at the top of the PDF.</p><div class="ppe">` +
    PPE.map(
      (x) =>
        `<label class="pp${on.has(x.k) ? " on" : ""}"><input type="checkbox" data-ppe="${x.k}"${on.has(x.k) ? " checked" : ""}>${ppeSvg(x)}<span>${x.n}</span></label>`,
    ).join("") +
    `</div><label class="f">Other safety equipment (optional)<input data-f="ppeo" value="${esc(p.ppeo || "")}" placeholder="e.g. Cut-resistant sleeves, welding apron"></label>`
  );
}

// PNG copies of the pictograms for the PDF (jsPDF cannot draw SVG).
// Resolves null if the browser cannot convert it; the PDF then draws a plain
// circle with the name underneath.
const PPE_PNG = new Map();
function ppePng(x) {
  if (!PPE_PNG.has(x.k))
    PPE_PNG.set(
      x.k,
      new Promise((res) => {
        const i = new Image();
        i.onload = () => {
          try {
            const c = document.createElement("canvas");
            c.width = c.height = 300;
            c.getContext("2d").drawImage(i, 0, 0, 300, 300);
            res(c.toDataURL("image/png"));
          } catch (e) {
            res(null);
          }
        };
        i.onerror = () => res(null);
        i.src =
          "data:image/svg+xml;charset=utf-8," + encodeURIComponent(ppeSvg(x));
      }),
    );
  return PPE_PNG.get(x.k);
}
