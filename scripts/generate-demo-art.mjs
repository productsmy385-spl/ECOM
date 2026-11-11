#!/usr/bin/env node
/**
 * Generates the DEMO product and category artwork (original SVG illustrations,
 * no stock photos or third-party assets) into both apps' public/demo folders.
 *   node scripts/generate-demo-art.mjs
 * Replace with real product photography (uploaded via the admin) before launch.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDirs = [join(root, "apps/web/public/demo"), join(root, "apps/admin/public/demo")];
for (const d of outDirs) mkdirSync(d, { recursive: true });

let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = (a) => a[Math.floor(rnd() * a.length)];

const MOULDING = {
  walnut: ["#7a4b2a", "#5b3519", "#9a6640"],
  black: ["#2a2a2a", "#111111", "#4a4a4a"],
  white: ["#f4f1ec", "#d9d4cc", "#ffffff"],
  gold: ["#d4a93a", "#a87b1d", "#f1d27a"],
  oak: ["#c79a62", "#a3773f", "#e0bb86"],
  crimson: ["#cf0f47", "#a80c3a", "#ff4d7e"],
};

const svg = (w, h, body, bg = "#fff5f5") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img"><rect width="${w}" height="${h}" fill="${bg}"/>${body}</svg>`;

let gid = 0;
const id = (p) => `${p}${++gid}`;

function landscape(x, y, w, h, palette = 0) {
  const skies = [["#ffd6c9", "#ffeeda"], ["#bfe3ff", "#eaf6ff"], ["#ffc6d9", "#fff0f5"], ["#d8c8ff", "#f3eeff"]];
  const hills = [["#cf0f47", "#ff6f91"], ["#2f7d6d", "#6cbf9f"], ["#8a3ffc", "#c3a3ff"], ["#1d4ed8", "#7aa2ff"]];
  const [s1, s2] = skies[palette % skies.length];
  const [h1, h2] = hills[palette % hills.length];
  const g = id("sky");
  return `<defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s1}"/><stop offset="1" stop-color="${s2}"/></linearGradient></defs>
  <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${g})"/>
  <circle cx="${x + w * 0.72}" cy="${y + h * 0.3}" r="${w * 0.09}" fill="#fff6c9" opacity=".95"/>
  <path d="M${x} ${y + h * 0.72} Q ${x + w * 0.25} ${y + h * 0.45} ${x + w * 0.5} ${y + h * 0.66} T ${x + w} ${y + h * 0.58} V ${y + h} H ${x} Z" fill="${h2}"/>
  <path d="M${x} ${y + h * 0.85} Q ${x + w * 0.35} ${y + h * 0.62} ${x + w * 0.62} ${y + h * 0.82} T ${x + w} ${y + h * 0.78} V ${y + h} H ${x} Z" fill="${h1}"/>`;
}

function portrait(x, y, w, h, palette = 0) {
  const bgs = [["#ffe4ec", "#ffd0dc"], ["#e6f0ff", "#cfe0ff"], ["#fff1d6", "#ffe0a8"]];
  const [b1, b2] = bgs[palette % bgs.length];
  const g = id("pt");
  const cx = x + w / 2;
  return `<defs><radialGradient id="${g}" cx=".5" cy=".35" r=".8"><stop offset="0" stop-color="${b1}"/><stop offset="1" stop-color="${b2}"/></radialGradient></defs>
  <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${g})"/>
  <circle cx="${cx - w * 0.14}" cy="${y + h * 0.42}" r="${w * 0.11}" fill="#6b3f2a"/>
  <path d="M${cx - w * 0.38} ${y + h} Q ${cx - w * 0.14} ${y + h * 0.5} ${cx + w * 0.08} ${y + h} Z" fill="#cf0f47"/>
  <circle cx="${cx + w * 0.15}" cy="${y + h * 0.46}" r="${w * 0.1}" fill="#3b2418"/>
  <path d="M${cx - w * 0.06} ${y + h} Q ${cx + w * 0.15} ${y + h * 0.56} ${cx + w * 0.38} ${y + h} Z" fill="#1f1f1f"/>
  <path d="M${cx} ${y + h * 0.16} c -10 -14 -32 -4 -20 12 l 20 18 l 20 -18 c 12 -16 -10 -26 -20 -12 z" fill="#ff0b55" opacity=".85"/>`;
}

function flowers(x, y, w, h, tint) {
  let out = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${tint}" opacity=".55"/>`;
  const petals = ["#ff6f91", "#ffb3c6", "#ffffff", "#c3a3ff", "#ffd166", "#ff0b55"];
  for (let i = 0; i < 9; i++) {
    const fx = x + w * (0.12 + rnd() * 0.76);
    const fy = y + h * (0.12 + rnd() * 0.76);
    const r = w * (0.035 + rnd() * 0.04);
    const col = pick(petals);
    const n = 5 + Math.floor(rnd() * 3);
    for (let p = 0; p < n; p++) {
      const a = (p / n) * 360 + rnd() * 20;
      out += `<ellipse cx="${fx}" cy="${fy - r}" rx="${r * 0.55}" ry="${r}" fill="${col}" opacity=".9" transform="rotate(${a} ${fx} ${fy})"/>`;
    }
    out += `<circle cx="${fx}" cy="${fy}" r="${r * 0.35}" fill="#ffd166"/>`;
    // stem
    out += `<path d="M${fx} ${fy + r * 0.4} q ${r * 0.6} ${r * 1.8} ${r * 0.2} ${r * 3}" stroke="#3f8f5a" stroke-width="${r * 0.18}" fill="none" opacity=".8"/>`;
  }
  // gold flakes and glitter
  for (let i = 0; i < 26; i++) {
    const gx = x + rnd() * w;
    const gy = y + rnd() * h;
    const s = 2 + rnd() * 7;
    out += `<polygon points="${gx},${gy - s} ${gx + s * 0.8},${gy} ${gx},${gy + s * 0.6} ${gx - s * 0.7},${gy + s * 0.1}" fill="#e2b33c" opacity=".85"/>`;
  }
  for (let i = 0; i < 60; i++) out += `<circle cx="${x + rnd() * w}" cy="${y + rnd() * h}" r="${0.8 + rnd() * 1.8}" fill="#fff" opacity=".9"/>`;
  return out;
}

function footprints(x, y, w, h) {
  let out = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#ffeaf1"/>`;
  const foot = (cx, cy, s, flip) => {
    let f = `<ellipse cx="${cx}" cy="${cy}" rx="${s * 0.42}" ry="${s}" fill="#cf0f47" opacity=".85"/>`;
    const toes = [[-0.3, -1.15, 0.16], [-0.08, -1.25, 0.13], [0.12, -1.22, 0.11], [0.28, -1.12, 0.09], [0.4, -0.98, 0.08]];
    for (const [dx, dy, r] of toes) f += `<circle cx="${cx + dx * s * (flip ? -1 : 1)}" cy="${cy + dy * s}" r="${r * s}" fill="#cf0f47" opacity=".85"/>`;
    return f;
  };
  out += foot(x + w * 0.38, y + h * 0.6, h * 0.22, false) + foot(x + w * 0.62, y + h * 0.56, h * 0.22, true);
  out += `<text x="${x + w / 2}" y="${y + h * 0.92}" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="${h * 0.075}" fill="#7a1230">Aarav · 12.03.2026</text>`;
  for (let i = 0; i < 40; i++) out += `<circle cx="${x + rnd() * w}" cy="${y + rnd() * h}" r="${1 + rnd() * 2}" fill="#e2b33c" opacity=".8"/>`;
  return out;
}

function nameArt(x, y, w, h, name, line) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff8f3"/>
  <text x="${x + w / 2}" y="${y + h * 0.45}" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-weight="700" font-size="${h * 0.15}" fill="#cf0f47">${name}</text>
  <line x1="${x + w * 0.3}" y1="${y + h * 0.56}" x2="${x + w * 0.7}" y2="${y + h * 0.56}" stroke="#e2b33c" stroke-width="3"/>
  <text x="${x + w / 2}" y="${y + h * 0.68}" text-anchor="middle" font-family="Georgia, serif" font-size="${h * 0.06}" fill="#333">${line}</text>
  <text x="${x + w / 2}" y="${y + h * 0.78}" text-anchor="middle" font-family="Georgia, serif" font-size="${h * 0.045}" fill="#777">brave · kind · bright</text>`;
}

function familyTree(x, y, w, h) {
  let out = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#f5fbf3"/>
  <path d="M${x + w / 2} ${y + h * 0.95} C ${x + w * 0.48} ${y + h * 0.7}, ${x + w * 0.52} ${y + h * 0.6}, ${x + w / 2} ${y + h * 0.45}" stroke="#7a4b2a" stroke-width="${w * 0.04}" fill="none"/>`;
  const spots = [[0.5, 0.25], [0.3, 0.35], [0.7, 0.35], [0.2, 0.55], [0.4, 0.5], [0.6, 0.5], [0.8, 0.55]];
  for (const [i, [px, py]] of spots.entries()) {
    out += `<circle cx="${x + w * px}" cy="${y + h * py}" r="${w * 0.08}" fill="${["#6cbf9f", "#2f7d6d", "#9bd3b3"][i % 3]}"/>`;
    out += `<circle cx="${x + w * px}" cy="${y + h * py}" r="${w * 0.045}" fill="#fff"/>`;
    out += `<circle cx="${x + w * px}" cy="${y + h * py - w * 0.012}" r="${w * 0.016}" fill="#7a4b2a"/>`;
  }
  return out;
}

/** A framed picture: moulding with bevel, white mat, inner art. */
function framed({ cx, cy, w, h, moulding = "walnut", border = 0.09, mat = 0.08, inner, shadow = true, glass = false }) {
  const [base, dark, light] = MOULDING[moulding];
  const x = cx - w / 2;
  const y = cy - h / 2;
  const b = Math.min(w, h) * border;
  const m = Math.min(w, h) * mat;
  const g = id("mould");
  const ix = x + b + m;
  const iy = y + b + m;
  const iw = w - 2 * (b + m);
  const ih = h - 2 * (b + m);
  const clip = id("clip");
  return `<defs>
    <linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${light}"/><stop offset=".45" stop-color="${base}"/><stop offset="1" stop-color="${dark}"/></linearGradient>
    <clipPath id="${clip}"><rect x="${ix}" y="${iy}" width="${iw}" height="${ih}"/></clipPath>
  </defs>
  ${shadow ? `<rect x="${x + 10}" y="${y + 16}" width="${w}" height="${h}" rx="4" fill="#000" opacity=".16" filter="blur(2px)"/>` : ""}
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="url(#${g})"/>
  <rect x="${x + b * 0.45}" y="${y + b * 0.45}" width="${w - b * 0.9}" height="${h - b * 0.9}" fill="none" stroke="${light}" stroke-opacity=".5" stroke-width="2"/>
  <rect x="${x + b}" y="${y + b}" width="${w - 2 * b}" height="${h - 2 * b}" fill="${glass ? "#ffffff" : "#fbfaf7"}"/>
  <g clip-path="url(#${clip})">${inner(ix, iy, iw, ih)}</g>
  <rect x="${ix}" y="${iy}" width="${iw}" height="${ih}" fill="none" stroke="#000" stroke-opacity=".12"/>
  <path d="M${x + b} ${y + b} L ${x + w * 0.55} ${y + b} L ${x + b} ${y + h * 0.5} Z" fill="#fff" opacity=".12"/>`;
}

function wall(body, color = "#fff5f5") {
  return svg(800, 800, `<rect y="640" width="800" height="160" fill="#f1e4e4"/>${body}`, color);
}

function tableFrame(moulding, inner) {
  return svg(
    800,
    800,
    `<rect y="560" width="800" height="240" fill="#ead9cf"/><rect y="560" width="800" height="6" fill="#d9c3b6"/>
     <ellipse cx="400" cy="610" rx="230" ry="22" fill="#000" opacity=".12"/>
     ${framed({ cx: 400, cy: 400, w: 400, h: 500, moulding, inner })}`,
    "#fff7f2",
  );
}

const ART = {
  "classic-wooden-photo-frame": () => wall(framed({ cx: 400, cy: 360, w: 460, h: 560, moulding: "walnut", inner: (x, y, w, h) => landscape(x, y, w, h, 0) })),
  "classic-wooden-photo-frame-2": () => wall(framed({ cx: 400, cy: 360, w: 460, h: 560, moulding: "black", inner: (x, y, w, h) => landscape(x, y, w, h, 1) })),
  "gold-ornate-photo-frame": () => wall(framed({ cx: 400, cy: 360, w: 480, h: 580, moulding: "gold", border: 0.13, inner: (x, y, w, h) => portrait(x, y, w, h, 2) }), "#fdf6ee"),
  "minimal-black-table-top-frame": () => tableFrame("black", (x, y, w, h) => landscape(x, y, w, h, 3)),
  "floating-glass-table-frame": () =>
    svg(800, 800, `<rect y="560" width="800" height="240" fill="#e9e4ee"/><ellipse cx="400" cy="606" rx="200" ry="18" fill="#000" opacity=".1"/>
      <rect x="230" y="150" width="340" height="440" rx="10" fill="#e9f6ff" opacity=".7" stroke="#bcd8ea" stroke-width="4"/>
      <g>${flowers(270, 200, 260, 330, "#ffffff")}</g>
      <rect x="230" y="150" width="340" height="440" rx="10" fill="none" stroke="#fff" stroke-width="2" opacity=".8"/>
      <rect x="215" y="575" width="370" height="26" rx="6" fill="#7a4b2a"/>`, "#f7f5fb"),
  "personalised-photo-frame-with-name": () =>
    wall(framed({ cx: 400, cy: 350, w: 460, h: 560, moulding: "white", inner: (x, y, w, h) => `${portrait(x, y, w, h * 0.78, 0)}<rect x="${x}" y="${y + h * 0.78}" width="${w}" height="${h * 0.22}" fill="#fff"/><text x="${x + w / 2}" y="${y + h * 0.93}" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="${h * 0.09}" fill="#cf0f47">Riya &amp; Arjun</text>` })),
  "couple-photo-frame-with-date": () =>
    wall(framed({ cx: 400, cy: 350, w: 520, h: 460, moulding: "crimson", inner: (x, y, w, h) => `${portrait(x, y, w, h, 1)}<rect x="${x}" y="${y + h * 0.8}" width="${w}" height="${h * 0.2}" fill="#000" opacity=".45"/><text x="${x + w / 2}" y="${y + h * 0.94}" text-anchor="middle" font-family="Georgia, serif" font-size="${h * 0.09}" fill="#fff">Since 14 · 02 · 2021</text>` })),
  "pressed-flower-resin-frame": () =>
    wall(framed({ cx: 400, cy: 360, w: 440, h: 560, moulding: "gold", mat: 0.02, glass: true, inner: (x, y, w, h) => flowers(x, y, w, h, "#fff0f5") }), "#fdf3f6"),
  "pressed-flower-resin-frame-2": () =>
    wall(framed({ cx: 400, cy: 360, w: 440, h: 560, moulding: "oak", mat: 0.02, glass: true, inner: (x, y, w, h) => flowers(x, y, w, h, "#eef7ff") }), "#f4f8fc"),
  "glitter-resin-keepsake-frame": () =>
    wall(framed({ cx: 400, cy: 360, w: 500, h: 500, moulding: "white", mat: 0.02, glass: true, inner: (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#ffd6e3"/>${flowers(x, y, w, h, "#ffb3c6")}` })),
  "baby-footprint-resin-frame": () => wall(framed({ cx: 400, cy: 360, w: 480, h: 480, moulding: "white", mat: 0.04, glass: true, inner: footprints }), "#fff6f9"),
  "four-photo-collage-frame": () =>
    wall(framed({ cx: 400, cy: 350, w: 560, h: 560, moulding: "black", mat: 0.05, inner: (x, y, w, h) => {
      const gap = w * 0.04;
      const cw = (w - gap) / 2;
      const ch = (h - gap) / 2;
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff"/>${landscape(x, y, cw, ch, 0)}${portrait(x + cw + gap, y, cw, ch, 1)}${portrait(x, y + ch + gap, cw, ch, 2)}${landscape(x + cw + gap, y + ch + gap, cw, ch, 3)}`;
    } })),
  "family-tree-collage-frame": () => wall(framed({ cx: 400, cy: 350, w: 560, h: 520, moulding: "walnut", inner: familyTree }), "#f6faf4"),
  "name-meaning-quote-frame": () => wall(framed({ cx: 400, cy: 350, w: 460, h: 560, moulding: "gold", inner: (x, y, w, h) => nameArt(x, y, w, h, "Ananya", "Grace · Infinite") }), "#fdf6ee"),
  "gallery-wall-frame-set": () =>
    wall(
      framed({ cx: 230, cy: 330, w: 250, h: 330, moulding: "black", inner: (x, y, w, h) => landscape(x, y, w, h, 2) }) +
        framed({ cx: 540, cy: 250, w: 280, h: 210, moulding: "black", inner: (x, y, w, h) => landscape(x, y, w, h, 1) }) +
        framed({ cx: 540, cy: 490, w: 280, h: 210, moulding: "black", inner: (x, y, w, h) => portrait(x, y, w, h, 0) }),
    ),
  "mothers-day-gift-frame": () =>
    svg(800, 800, `<rect y="580" width="800" height="220" fill="#f7d9e3"/>
      ${framed({ cx: 400, cy: 380, w: 420, h: 480, moulding: "crimson", inner: (x, y, w, h) => `${portrait(x, y, w, h * 0.75, 0)}<rect x="${x}" y="${y + h * 0.75}" width="${w}" height="${h * 0.25}" fill="#fff"/><text x="${x + w / 2}" y="${y + h * 0.92}" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="${h * 0.1}" fill="#cf0f47">Love you, Maa</text>` })}
      <rect x="560" y="560" width="150" height="110" rx="8" fill="#cf0f47"/><rect x="625" y="560" width="20" height="110" fill="#ffdede"/><path d="M635 560 c -30 -40 -70 -10 -40 10 z M635 560 c 30 -40 70 -10 40 10 z" fill="#ff0b55"/>`, "#fff5f8"),
};

const CATEGORY_ART = {
  "photo-frames": "classic-wooden-photo-frame",
  "custom-photo-frames": "personalised-photo-frame-with-name",
  "resin-art-frames": "pressed-flower-resin-frame",
  "collage-frames": "four-photo-collage-frame",
  "name-quote-frames": "name-meaning-quote-frame",
  "wall-frames": "gallery-wall-frame-set",
  "table-top-frames": "minimal-black-table-top-frame",
  "gift-frames": "mothers-day-gift-frame",
};

let count = 0;
for (const [name, make] of Object.entries(ART)) {
  const out = make();
  for (const d of outDirs) writeFileSync(join(d, `${name}.svg`), out);
  count++;
}
for (const [cat, art] of Object.entries(CATEGORY_ART)) {
  seed = 11;
  const out = ART[art]();
  for (const d of outDirs) writeFileSync(join(d, `cat-${cat}.svg`), out);
  count++;
}
console.log(`[demo-art] wrote ${count} SVGs to ${outDirs.length} folders`);
