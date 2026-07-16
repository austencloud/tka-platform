// scripts/half-glyph-parity.mjs
// Run: npx tsx scripts/half-glyph-parity.mjs
//
// Numeric parity oracle for the `_half` arrow assets: pushes each stored SVG
// through the EXACT pipeline transform ArrowSvg applies
// (translate(anchor) . rotate(R) . mirror(F) . translate(-centerPoint)) and
// compares the result against the guide's drawn halfway frame in the same 950
// viewBox (LIFTED_TURN_FRAMES). Four frames are extraction seeds (identity by
// construction); the p22 pro-t2 / anti-t2 frames are true generalization
// tests — a wrong rotation/mirror rule shows up there as a bearing or
// principal-axis delta.
//
// Metrics per frame (drawn vs pipeline):
//   bearing  — angle of glyph centroid around the hand-point anchor
//   radial   — centroid distance from anchor (pipeline stores 2x drawn scale,
//              so ratio ~2.0 is "as designed")
//   axis     — principal-axis angle of the glyph point cloud (mod 180)
//   chirality— sign of the shoelace signed area (mirror errors flip it)
import { LIFTED_TURN_FRAMES } from "../src/routes/(public)/guide/level-2/_data/lifted-turn-arrows.ts";
import { calculateOrientationAt } from "../src/lib/shared/animation-engine/services/orientation-at.ts";
import { calculateSegmentRotation } from "../src/lib/shared/pictograph/arrow/positioning/calculation/services/segment-rotation.ts";
import { GridLocation } from "../src/lib/shared/pictograph/grid/domain/enums/grid-enums.ts";
import {
  MotionType,
  Orientation,
  RotationDirection,
} from "../src/lib/shared/pictograph/shared/domain/enums/pictograph-enums.ts";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const CW = RotationDirection.CLOCKWISE;
const CCW = RotationDirection.COUNTER_CLOCKWISE;
const { IN, OUT } = Orientation;
const SCALE = 2.0; // stored assets are 2x drawn scale

const POINT = {
  [GridLocation.EAST]: { x: 618.1, y: 475 },
  [GridLocation.SOUTHEAST]: { x: 618.1, y: 618.1 },
  [GridLocation.CENTER]: { x: 475, y: 475 },
};

// frame key -> the motion that halfway frame draws (from the guide pages).
// seed: the frame the asset was extracted from (identity check).
const CASES = [
  { name: "PRO E→S t1", frame: "p2_s0_f1", mt: MotionType.PRO, asset: "pro_half_1.0", rot: CW, turns: 1, start: GridLocation.EAST, end: GridLocation.SOUTH, endOri: OUT, mid: GridLocation.SOUTHEAST },
  { name: "ANTI E→S t1", frame: "p2_s1_f1", mt: MotionType.ANTI, asset: "anti_half_1.0", rot: CCW, turns: 1, start: GridLocation.EAST, end: GridLocation.SOUTH, endOri: IN, mid: GridLocation.SOUTHEAST },
  { name: "PRO E→S t2", frame: "p22_s0_f1", mt: MotionType.PRO, asset: "pro_half_2.0", rot: CW, turns: 2, start: GridLocation.EAST, end: GridLocation.SOUTH, endOri: IN, mid: GridLocation.SOUTHEAST },
  { name: "ANTI E→S t2", frame: "p22_s2_f1", mt: MotionType.ANTI, asset: "anti_half_2.0", rot: CCW, turns: 2, start: GridLocation.EAST, end: GridLocation.SOUTH, endOri: IN, mid: GridLocation.SOUTHEAST },
  { name: "DASH S→N t2", frame: "p23_s1_f1", mt: MotionType.DASH, asset: "dash_half_2.0", rot: CCW, turns: 2, start: GridLocation.SOUTH, end: GridLocation.NORTH, endOri: OUT, mid: GridLocation.CENTER },
  { name: "STATIC E t2", frame: "p23_s2_f3", mt: MotionType.STATIC, asset: "static_half_2.0", rot: CCW, turns: 2, start: GridLocation.EAST, end: GridLocation.EAST, endOri: IN, mid: GridLocation.EAST },
];

function seedMirrored(mt, rot) {
  return mt === MotionType.ANTI ? rot === CW : rot !== CW;
}

const num = /-?\d+(?:\.\d+)?/g;
function pairs(d) {
  const nums = (d.match(num) ?? []).map(Number);
  const out = [];
  for (let i = 0; i + 1 < nums.length; i += 2) out.push([nums[i], nums[i + 1]]);
  return out;
}

function centroid(pts) {
  let x = 0, y = 0;
  for (const [px, py] of pts) { x += px; y += py; }
  return [x / pts.length, y / pts.length];
}

function signedArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

/** Principal-axis angle (deg, mod 180) of a point cloud. */
function principalAxis(pts) {
  const [cx, cy] = centroid(pts);
  let sxx = 0, syy = 0, sxy = 0;
  for (const [x, y] of pts) {
    const dx = x - cx, dy = y - cy;
    sxx += dx * dx; syy += dy * dy; sxy += dx * dy;
  }
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  return ((theta * 180 / Math.PI) % 180 + 180) % 180;
}

const deg = (r) => (r * 180 / Math.PI);
const norm180 = (d) => ((d + 540) % 360) - 180;
const norm90 = (d) => { let v = ((d % 180) + 180) % 180; return v > 90 ? v - 180 : v; };

console.log("case                     | bearingΔ° | radial ratio | axisΔ° | chirality");
console.log("-".repeat(80));

for (const c of CASES) {
  const drawnPaths = LIFTED_TURN_FRAMES[c.frame];
  if (!drawnPaths || !drawnPaths[1]) { console.log(`${c.name}: MISSING frame ${c.frame}[1]`); continue; }
  const drawn = pairs(drawnPaths[1].d);
  const H = POINT[c.mid];

  // Pipeline numbers for this motion.
  const halfwayOri = calculateOrientationAt(
    { motionType: c.mt, rotationDirection: c.rot, startLocation: c.start, endLocation: c.end, startOrientation: IN, endOrientation: c.endOri, turns: c.turns },
    0.5
  );
  if (!halfwayOri) { console.log(`${c.name}: null halfway orientation`); continue; }
  const R = calculateSegmentRotation(halfwayOri, c.mid, c.start);
  const F = seedMirrored(c.mt, c.rot);

  // Stored asset -> frame space via the ArrowSvg transform.
  const assetDir = c.asset.replace(/_half.*/, "_half");
  const svg = readFileSync(resolve(process.cwd(), `static/images/arrows/${assetDir}/from_radial/${c.asset}.svg`), "utf8");
  const dMatch = svg.match(/<path d="([^"]+)"/);
  const cpMatch = svg.match(/id="centerPoint" cx="([^"]+)" cy="([^"]+)"/);
  if (!dMatch || !cpMatch) { console.log(`${c.name}: asset missing path/centerPoint`); continue; }
  const cp = [Number(cpMatch[1]), Number(cpMatch[2])];
  const rad = (R * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const piped = pairs(dMatch[1]).map(([x, y]) => {
    let u = x - cp[0], v = y - cp[1];
    if (F) v = -v; // segment mirror = scale(1,-1) across the staff axis, pre-rotate
    const rx = u * cos - v * sin;
    const ry = u * sin + v * cos;
    return [H.x + rx, H.y + ry];
  });

  const [dcx, dcy] = centroid(drawn);
  const [pcx, pcy] = centroid(piped);
  const dBear = deg(Math.atan2(dcy - H.y, dcx - H.x));
  const pBear = deg(Math.atan2(pcy - H.y, pcx - H.x));
  const dRad = Math.hypot(dcx - H.x, dcy - H.y);
  const pRad = Math.hypot(pcx - H.x, pcy - H.y);
  const axisDelta = norm90(principalAxis(piped) - principalAxis(drawn));
  const chOk = Math.sign(signedArea(piped)) === Math.sign(signedArea(drawn));

  console.log(
    `${c.name.padEnd(24)} | ${norm180(pBear - dBear).toFixed(1).padStart(8)} | ${(pRad / dRad).toFixed(2).padStart(12)} | ${axisDelta.toFixed(1).padStart(6)} | ${chOk ? "match" : "FLIPPED"}  (R=${R.toFixed(0)}°, F=${F}, ori=${halfwayOri})`
  );
}
