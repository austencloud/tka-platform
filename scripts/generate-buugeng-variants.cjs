/**
 * Buugeng variant generator.
 *
 * A buugeng is two half-circles flipped and joined at the centre (Moschen / Dai
 * Zaobab). We model the S *centreline* as two semicircles, then build a filled
 * ribbon by offsetting each sampled centreline point along its normal by a
 * per-point half-width. Driving that half-width (and the tip sharpness, edge
 * spikes, and punched holes) from a profile function gives genuinely different
 * silhouettes — thick-bellied lunes, undulating waves, spiked blades, perforated
 * ribbons — instead of one shape with different shading.
 *
 * Output SVGs follow the recolor-safe convention: a solid body fill (#2e3191)
 * that the app's color pipeline swaps to the hand color, plus a url() gloss
 * overlay + dark rim stroke that survive recolor.
 *
 * Run: node scripts/generate-buugeng-variants.cjs
 */

const fs = require("fs");
const path = require("path");

const OUT_DIR = path.join(
  __dirname,
  "..",
  "static",
  "images",
  "props",
  "variants"
);

// Geometry tuned to the real reference props (see scripts/_tmp-analyze-buugeng):
// slender, elongated crescents whose lobes sweep PAST 180° so the tips curl
// inward to sharp points. CX/CY are just the construction origin; the final
// viewBox is auto-fit to the drawn content.
const CX = 150;
const CY = 90;
const R = 70; // centreline lobe radius
const CURL = 0.62; // extra sweep per lobe beyond 180°, in radians (~35°). Curls tips in.
// Long-axis stretch: real buugeng lobes are elongated (elliptical), not pure
// semicircles. Stretching the centreline along x raises length:thickness from
// ~1.6 to ~2.2 to match the reference props. Width is applied perpendicular and
// holes are placed at centreline points, so both stay round (only the path of
// the S elongates).
const STRETCH = 1.4;
const SAMPLES = 200; // per lobe

const BODY = "#2e3191";
const RIM = "#14163a";

// ── centreline ────────────────────────────────────────────────────────────
// s in [0,1] across the whole S. [0,0.5] = first lobe (tip -> centre), [0.5,1] =
// second lobe (centre -> tip). Each lobe sweeps (pi + CURL); the extra CURL is
// spent at the tip end so the points hook inward like the real prop. The lobes
// stay continuous at the centre join (s=0.5).
function centre(s) {
  const sweep = Math.PI + CURL;
  let x, y;
  if (s <= 0.5) {
    const t = s / 0.5; // 0 at tip, 1 at centre
    const theta = sweep * (1 - t); // tip: sweep (past pi) -> centre: 0
    x = CX - R + R * Math.cos(theta);
    y = CY - R * Math.sin(theta);
  } else {
    const u = (s - 0.5) / 0.5; // 0 at centre, 1 at tip
    const phi = Math.PI + sweep * u; // centre: pi -> tip: pi + sweep (past 2pi)
    x = CX + R + R * Math.cos(phi);
    y = CY - R * Math.sin(phi);
  }
  return { x: CX + (x - CX) * STRETCH, y };
}

// unit normal at s (rotate tangent +90deg), via central difference.
function normal(s) {
  const e = 1e-4;
  const a = centre(Math.max(0, s - e));
  const b = centre(Math.min(1, s + e));
  let tx = b.x - a.x;
  let ty = b.y - a.y;
  const len = Math.hypot(tx, ty) || 1;
  tx /= len;
  ty /= len;
  return { x: -ty, y: tx };
}

function fmt(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Build a ribbon path d-string.
 * @param outerW (s)=>halfWidth on the +normal side
 * @param innerW (s)=>halfWidth on the -normal side
 */
function ribbon(outerW, innerW) {
  const outer = [];
  const inner = [];
  const bbox = { minx: Infinity, miny: Infinity, maxx: -Infinity, maxy: -Infinity };
  const acc = (x, y) => {
    if (x < bbox.minx) bbox.minx = x;
    if (x > bbox.maxx) bbox.maxx = x;
    if (y < bbox.miny) bbox.miny = y;
    if (y > bbox.maxy) bbox.maxy = y;
  };
  for (let i = 0; i <= SAMPLES; i++) {
    const s = i / SAMPLES;
    const p = centre(s);
    const n = normal(s);
    const o = [p.x + n.x * outerW(s), p.y + n.y * outerW(s)];
    const iv = [p.x - n.x * innerW(s), p.y - n.y * innerW(s)];
    outer.push(o);
    inner.push(iv);
    acc(o[0], o[1]);
    acc(iv[0], iv[1]);
  }
  let d = `M${fmt(outer[0][0])} ${fmt(outer[0][1])}`;
  for (let i = 1; i < outer.length; i++) d += `L${fmt(outer[i][0])} ${fmt(outer[i][1])}`;
  for (let i = inner.length - 1; i >= 0; i--) d += `L${fmt(inner[i][0])} ${fmt(inner[i][1])}`;
  d += "Z";
  return { d, bbox };
}

// triangle wave 0..1 with `cycles` peaks over s in [0,1]
function tri(s, cycles) {
  const x = (s * cycles) % 1;
  return x < 0.5 ? x * 2 : 2 - x * 2;
}

// per-lobe envelope: 0 at the two tips AND at the centre join (s=0,0.5,1), 1 at
// each lobe's belly (s=0.25,0.75). Used to add edge detail (spikes/teeth) that
// fades out at the join so the S stays continuous there.
function lobeEnv(s, sharp = 1) {
  return Math.pow(Math.abs(Math.sin(2 * Math.PI * s)), sharp);
}

// ── SVG assembly ────────────────────────────────────────────────────────────
// `built` is the ribbon() result { d, bbox }. viewBox is auto-fit to the content
// plus padding, so curled tips / spikes never clip and proportions stay true.
function svg(built, { holes = [], rimWidth = 2, flat = false } = {}) {
  const { d: bodyD, bbox } = built;
  const PAD = rimWidth + 2;
  const vx = fmt(bbox.minx - PAD);
  const vy = fmt(bbox.miny - PAD);
  const vw = fmt(bbox.maxx - bbox.minx + PAD * 2);
  const vh = fmt(bbox.maxy - bbox.miny + PAD * 2);

  const fillRule = holes.length ? ' fill-rule="evenodd"' : "";
  let bodyPath = bodyD;
  for (const h of holes) bodyPath += h; // holes are extra subpaths, cut via evenodd

  // Flat variants (spiky silhouettes) skip the vertical gloss: an S puts one lobe
  // in the gradient's dark half, which swallows that lobe's teeth on a dark
  // background. A flat fill + light rim keeps the silhouette legible on both
  // lobes and on any background. A radial sheen still adds a little form.
  const defs = flat
    ? `<radialGradient id="sheen" cx="0.5" cy="0.42" r="0.62">
\t\t<stop offset="0" stop-color="#ffffff" stop-opacity="0.32"/>
\t\t<stop offset="0.6" stop-color="#ffffff" stop-opacity="0.05"/>
\t\t<stop offset="1" stop-color="#000000" stop-opacity="0.18"/>
\t</radialGradient>`
    : `<linearGradient id="sheen" x1="0" y1="${vy}" x2="0" y2="${fmt(bbox.maxy + PAD)}" gradientUnits="userSpaceOnUse">
\t\t<stop offset="0.04" stop-color="#ffffff" stop-opacity="0"/>
\t\t<stop offset="0.30" stop-color="#ffffff" stop-opacity="0.9"/>
\t\t<stop offset="0.48" stop-color="#ffffff" stop-opacity="0.06"/>
\t\t<stop offset="0.60" stop-color="#000000" stop-opacity="0"/>
\t\t<stop offset="1" stop-color="#000000" stop-opacity="0.55"/>
\t</linearGradient>`;

  // Flat rim is light (a thin highlight) so spikes read as a crisp edge; rounded
  // variants keep the dark rim for depth. Strokes survive recolor either way.
  const rim = flat ? "#cdd2ff" : RIM;
  const rimOpacity = flat ? ' stroke-opacity="0.55"' : "";

  return `<?xml version="1.0" encoding="utf-8"?>
<!-- Generated by scripts/generate-buugeng-variants.cjs. Body (#2e3191) recolors to
     hand color; sheen overlay + rim stroke survive recolor. -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}">
<defs>
\t${defs}
</defs>
<path d="${bodyPath}"${fillRule} fill="${BODY}" stroke="${rim}"${rimOpacity} stroke-width="${rimWidth}" stroke-linejoin="round"/>
<path d="${bodyPath}"${fillRule} fill="url(#sheen)"/>
</svg>
`;
}

// circle as an SVG subpath (two arcs), for evenodd holes.
function holeCircle(cx, cy, r) {
  return `M${fmt(cx - r)} ${fmt(cy)}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0Z`;
}

// Physically-correct width profile across the whole S (s in [0,1]):
//   tip (s=0)        -> thin   (pointed end)
//   lobe belly (0.25) -> thick  (the meat of each curve)
//   centre grip (0.5) -> thin   (you HOLD it here — must be slim)
//   lobe belly (0.75) -> thick
//   tip (s=1)        -> thin
// |sin(2*pi*s)| gives the two belly humps (0 at tips AND centre); a narrow bump
// at s=0.5 lifts the centre to a holdable neck thickness without fattening it.
function widthProfile(s, { tip, neck, belly }) {
  const humps = Math.abs(Math.sin(2 * Math.PI * s)); // 0 at tips+centre, 1 at bellies
  const centreNeck = Math.exp(-Math.pow((s - 0.5) / 0.1, 2)); // ~1 only near s=0.5
  return tip + (belly - tip) * humps + (neck - tip) * centreNeck;
}

// ── variants ────────────────────────────────────────────────────────────────
const variants = {};

// 1. LUNE — smooth rounded ribbon. Sharp pointed tips, slim grip neck, fat lobes.
{
  const w = (s) => widthProfile(s, { tip: 1, neck: 7, belly: 22 });
  variants["buugeng-lune"] = svg(ribbon(w, w));
}

// 2. TALON — razor crescent: thinner everywhere, needle tips. Same correct profile.
{
  const w = (s) => widthProfile(s, { tip: 0.6, neck: 5, belly: 15 });
  variants["buugeng-talon"] = svg(ribbon(w, w), { rimWidth: 1.6 });
}

// Teeth go on the CONVEX side of each lobe. The S reverses curvature at the join,
// so the convex side is the +normal edge on the first lobe and the −normal edge on
// the second. Route the teeth accordingly; lobeEnv zeroes them at tips + join.
function toothedEdges(base, teeth) {
  const plus = (s) => base(s) + (s <= 0.5 ? teeth(s) : 0);
  const minus = (s) => base(s) + (s > 0.5 ? teeth(s) : 0);
  return [plus, minus];
}

// 3. SPIKE — smooth concave edge, fine sawtooth on the convex edge of both lobes.
{
  const base = (s) => widthProfile(s, { tip: 3, neck: 6, belly: 13 });
  const teeth = (s) => 16 * lobeEnv(s, 0.85) * tri(s, 14);
  const [plus, minus] = toothedEdges(base, teeth);
  variants["buugeng-spike"] = svg(ribbon(plus, minus), { rimWidth: 1.4, flat: true });
}

// 4. FANG — a few big triangular teeth on the convex edge. Dramatic, aggressive.
{
  const base = (s) => widthProfile(s, { tip: 4, neck: 7, belly: 13 });
  const teeth = (s) => 26 * lobeEnv(s, 0.7) * tri(s, 4);
  const [plus, minus] = toothedEdges(base, teeth);
  variants["buugeng-fang"] = svg(ribbon(plus, minus), { rimWidth: 1.6, flat: true });
}

// 5. PERFORATED — matches the real reference props: a graduated row of holes runs
//    the length of each lobe, sized to the local thickness (tiny near the tips,
//    largest at the belly), tapering away at the slim grip neck and the tips.
{
  const w = (s) => widthProfile(s, { tip: 1.5, neck: 8, belly: 26 });
  const holes = [];
  // Walk each lobe; even spacing in s gives a clean row that follows the curve.
  for (const [s0, s1] of [[0.04, 0.46], [0.54, 0.96]]) {
    for (let s = s0; s <= s1 + 1e-9; s += 0.05) {
      const hr = 0.52 * w(s); // hole radius tracks local half-width -> auto-graduated
      if (hr < 2) continue; // too thin to perforate (near tip / neck)
      const p = centre(s);
      holes.push(holeCircle(p.x, p.y, hr));
    }
  }
  variants["buugeng-perf"] = svg(ribbon(w, w), { holes });
}

// ── write ───────────────────────────────────────────────────────────────────
let n = 0;
for (const [name, content] of Object.entries(variants)) {
  fs.writeFileSync(path.join(OUT_DIR, `${name}.svg`), content);
  console.log(`wrote ${name}.svg`);
  n++;
}
console.log(`\n${n} buugeng variants written to ${OUT_DIR}`);
