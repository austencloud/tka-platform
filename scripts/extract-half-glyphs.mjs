// scripts/extract-half-glyphs.mjs
// Run: npx tsx scripts/extract-half-glyphs.mjs
//
// Phase 2a Task 6: extract the four hand-drawn seed glyphs (fused staff-bar +
// glyph subpaths) out of LIFTED_TURN_FRAMES, re-origin each glyph subpath to
// its own bounding box, recolor to blue, and emit a bare parseArrowSvg-shaped
// SVG. Native orientation only — the rotational-reference normalization is
// Phase 2b, deliberately NOT attempted here.
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { LIFTED_TURN_FRAMES } from "../src/routes/(public)/guide/level-2/_data/lifted-turn-arrows.ts";

const SEEDS = [
  { mt: "pro", frame: "p2_s0_f1", idx: 1 },
  { mt: "anti", frame: "p2_s1_f1", idx: 1 },
  { mt: "dash", frame: "p23_s1_f1", idx: 1 },
  { mt: "static", frame: "p23_s2_f3", idx: 1 },
];

const BLUE = "#2e3192";
const num = /-?\d+(?:\.\d+)?/g;

/** Bounding box over all coordinate pairs in an M/L/C/Z path `d`. */
function bbox(d) {
  const nums = (d.match(num) ?? []).map(Number);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const x = nums[i], y = nums[i + 1];
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

/** Translate every coord pair in `d` by (-dx,-dy). Preserves command letters. */
function translate(d, dx, dy) {
  let k = 0;
  return d.replace(num, (m) => {
    const v = Number(m) - (k++ % 2 === 0 ? dx : dy);
    return v.toFixed(2);
  });
}

for (const { mt, frame, idx } of SEEDS) {
  const paths = LIFTED_TURN_FRAMES[frame];
  if (!paths || !paths[idx]) throw new Error(`missing ${frame}[${idx}]`);
  const d0 = paths[idx].d;
  const b = bbox(d0);
  const pad = 4;
  const w = (b.maxX - b.minX + pad * 2).toFixed(2);
  const h = (b.maxY - b.minY + pad * 2).toFixed(2);
  const d = translate(d0, b.minX - pad, b.minY - pad);
  const svg =
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" xml:space="preserve">` +
    `<path d="${d}" style="fill:${BLUE}"/></svg>`;
  const out = resolve(
    process.cwd(),
    `static/images/arrows/${mt}_half/from_radial/${mt}_half.svg`
  );
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, svg, "utf8");
  console.log(`wrote ${out} (viewBox 0 0 ${w} ${h})`);
}
