// scripts/extract-half-glyphs.mjs
// Run: npx tsx scripts/extract-half-glyphs.mjs
//
// Extracts the four hand-drawn seed glyphs (the arrow subpath of each guide
// halfway frame) out of LIFTED_TURN_FRAMES and normalizes them into
// pipeline-ready `_half` arrow SVGs:
//
//   1. ANCHOR — coordinates are re-based on the seed frame's hand point (the
//      grid dot the staff sits on), and that point is emitted as the SVG's
//      `id="centerPoint"`, which ArrowSvg/parseArrowSvg treat as the rotation +
//      placement anchor. This preserves the staff↔glyph offset exactly as
//      Austen drew it (the old bbox re-origin threw that offset away and the
//      glyph rendered centered ON the staff).
//   2. ROTATION — the glyph is pre-rotated by MINUS the seed motion's pipeline
//      rotation (calculateSegmentRotation over Phase 1's halfway orientation),
//      so when the pipeline rotates the asset for any target motion, the seed
//      motion reproduces the guide drawing exactly and every other 45deg
//      movement gets the same staff-relative geometry.
//   3. MIRROR — shouldMirrorArrow's table (anti mirrors when cw, others when
//      ccw) is inverted out of the seed art, so the stored asset is the
//      unmirrored-canonical form the pipeline expects.
//   4. SCALE — guide art is pedagogy-mark weight (~8.5-unit stroke in the 950
//      box); app arrows use ~17. Uniform 2x about the anchor brings the glyphs
//      to app-arrow visual weight.
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { LIFTED_TURN_FRAMES } from "../src/routes/(public)/guide/level-2/_data/lifted-turn-arrows.ts";
import { calculateOrientationAt } from "../src/lib/shared/animation-engine/services/orientation-at.ts";
import { calculateSegmentRotation } from "../src/lib/shared/pictograph/arrow/positioning/calculation/services/segment-rotation.ts";
import { GridLocation } from "../src/lib/shared/pictograph/grid/domain/enums/grid-enums.ts";
import {
  MotionType,
  Orientation,
  RotationDirection,
} from "../src/lib/shared/pictograph/shared/domain/enums/pictograph-enums.ts";

const BLUE = "#2e3192";
const SCALE = 2.0;
const PAD = 8;

// Diamond hand-point / center coords in the lifted frames' 950 viewBox — the
// same dots the frames were calibrated on (n/e/s/w at 331.9/618.1) and the
// same coords the pipeline anchors arrows to (proven by /test/half-arrows).
const POINT = {
  [GridLocation.EAST]: { x: 618.1, y: 475 },
  [GridLocation.SOUTHEAST]: { x: 618.1, y: 618.1 },
  [GridLocation.CENTER]: { x: 475, y: 475 },
};

// The guide page motions each seed frame draws (TurnsPage: pro E->S t1 CW,
// anti E->S t1 CCW; TwoTurnsDashStaticPage: dash S->N t2 CCW, static E t2 CCW).
const CW = RotationDirection.CLOCKWISE;
const CCW = RotationDirection.COUNTER_CLOCKWISE;
const SEEDS = [
  {
    mt: "pro", frame: "p2_s0_f1", idx: 1,
    motionType: MotionType.PRO, rot: CW, turns: 1,
    start: GridLocation.EAST, end: GridLocation.SOUTH,
    endOri: Orientation.OUT, mid: GridLocation.SOUTHEAST,
  },
  {
    mt: "anti", frame: "p2_s1_f1", idx: 1,
    motionType: MotionType.ANTI, rot: CCW, turns: 1,
    start: GridLocation.EAST, end: GridLocation.SOUTH,
    endOri: Orientation.IN, mid: GridLocation.SOUTHEAST,
  },
  {
    mt: "dash", frame: "p23_s1_f1", idx: 1,
    motionType: MotionType.DASH, rot: CCW, turns: 2,
    start: GridLocation.SOUTH, end: GridLocation.NORTH,
    endOri: Orientation.OUT, mid: GridLocation.CENTER,
  },
  {
    mt: "static", frame: "p23_s2_f3", idx: 1,
    motionType: MotionType.STATIC, rot: CCW, turns: 2,
    start: GridLocation.EAST, end: GridLocation.EAST,
    endOri: Orientation.IN, mid: GridLocation.EAST,
  },
];

/** shouldMirrorArrow's table (arrow-positioning-orchestrator.ts). */
function seedMirrored(motionType, rot) {
  const cw = rot === CW;
  return motionType === MotionType.ANTI ? cw : !cw;
}

const num = /-?\d+(?:\.\d+)?/g;

/**
 * Transform every absolute coordinate pair in `d` (M/L/C/Z commands only —
 * lifted-frame paths are fully absolute with paired coords) through `fn`.
 */
function mapPairs(d, fn) {
  const nums = [];
  d.replace(num, (m) => (nums.push(Number(m)), m));
  const out = [];
  for (let i = 0; i + 1 < nums.length; i += 2) out.push(fn(nums[i], nums[i + 1]));
  let k = 0;
  let axis = 0;
  return d.replace(num, () => {
    const p = out[k];
    const v = axis === 0 ? p[0] : p[1];
    if (axis === 1) k++;
    axis ^= 1;
    return v.toFixed(2);
  });
}

for (const seed of SEEDS) {
  const paths = LIFTED_TURN_FRAMES[seed.frame];
  if (!paths || !paths[seed.idx]) throw new Error(`missing ${seed.frame}[${seed.idx}]`);
  const d0 = paths[seed.idx].d;

  // Seed motion's pipeline rotation (self-consistent with calculateArrowPoint
  // per half-arrow-pipeline.test.ts assertion 3) and mirror flag.
  const halfwayOri = calculateOrientationAt(
    {
      motionType: seed.motionType,
      rotationDirection: seed.rot,
      startLocation: seed.start,
      endLocation: seed.end,
      startOrientation: Orientation.IN,
      endOrientation: seed.endOri,
      turns: seed.turns,
    },
    0.5
  );
  if (!halfwayOri) throw new Error(`${seed.mt}: null halfway orientation`);
  const rotationDeg = calculateSegmentRotation(halfwayOri, seed.mid, seed.start);
  const mirrored = seedMirrored(seed.motionType, seed.rot);
  const H = POINT[seed.mid];
  if (!H) throw new Error(`${seed.mt}: no anchor coords for ${seed.mid}`);

  // Invert the pipeline transform (translate(H) . rotate(R) . mirror?) so the
  // stored asset, run back through the pipeline for the seed motion, lands
  // exactly on the guide drawing. SVG rotate is y-down clockwise-positive.
  const rad = (-rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const pts = [];
  const dNorm = mapPairs(d0, (x, y) => {
    let u = x - H.x;
    let v = y - H.y;
    const ru = u * cos - v * sin;
    const rv = u * sin + v * cos;
    u = mirrored ? -ru : ru;
    v = rv;
    u *= SCALE;
    v *= SCALE;
    pts.push([u, v]);
    return [u, v];
  });

  // viewBox over the glyph plus the anchor itself, padded.
  let minX = 0, minY = 0, maxX = 0, maxY = 0; // (0,0) = anchor, always included
  for (const [u, v] of pts) {
    if (u < minX) minX = u;
    if (u > maxX) maxX = u;
    if (v < minY) minY = v;
    if (v > maxY) maxY = v;
  }
  const w = (maxX - minX + PAD * 2).toFixed(2);
  const h = (maxY - minY + PAD * 2).toFixed(2);
  const dx = PAD - minX;
  const dy = PAD - minY;
  const d = mapPairs(dNorm, (x, y) => [x + dx, y + dy]);
  const cx = dx.toFixed(2);
  const cy = dy.toFixed(2);

  const svg =
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" xml:space="preserve">` +
    `<path d="${d}" style="fill:${BLUE}"/>` +
    `<circle id="centerPoint" cx="${cx}" cy="${cy}" r="2" fill="none"/></svg>`;
  const out = resolve(
    process.cwd(),
    `static/images/arrows/${seed.mt}_half/from_radial/${seed.mt}_half.svg`
  );
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, svg, "utf8");
  console.log(
    `wrote ${out} (viewBox 0 0 ${w} ${h}, seed rotation ${rotationDeg.toFixed(1)}deg, mirrored=${mirrored}, centerPoint ${cx},${cy})`
  );
}
