// scripts/half-arrow-seeds.mjs
// Shared seed table for the half-arrow asset pipeline. Run under tsx only
// (imports app TypeScript): both build-half-arrow-templates.mjs and
// ingest-half-arrows.mjs consume this, so the seed motion, anchor, rotation,
// and mirror parameters can never drift between the template a glyph was
// drawn against and the normalization that ingests it.
//
// One CANONICAL SEED MOTION per (motionType, turns) family — the same motions
// /test/half-movements renders in its coverage matrix (familyCell):
//   pro    E->S, prop cw   (mid SE)
//   anti   E->S, prop ccw  (mid SE)
//   dash   S->N, ccw       (mid CENTER)
//   static E,    ccw       (mid E)
// The glyph asset is drawn against this one pose; every other start point and
// direction derives via the pipeline transform (rotate R, staff-axis mirror).
import { buildHalvedStep } from "../src/lib/shared/animation-engine/services/build-halved-step.ts";
import { calculateSegmentRotation } from "../src/lib/shared/pictograph/arrow/positioning/calculation/services/segment-rotation.ts";
import {
  createMotionData,
  createPlaceholderMotion,
} from "../src/lib/shared/pictograph/shared/domain/models/motion-data.ts";
import { GridLocation, GridMode } from "../src/lib/shared/pictograph/grid/domain/enums/grid-enums.ts";
import {
  MotionType,
  MotionColor,
  Orientation,
  RotationDirection,
} from "../src/lib/shared/pictograph/shared/domain/enums/pictograph-enums.ts";
import { PropType } from "../src/lib/shared/pictograph/prop/domain/enums/prop-type.ts";

const CW = RotationDirection.CLOCKWISE;
const CCW = RotationDirection.COUNTER_CLOCKWISE;

/** Diamond hand-point / center coords in the pictograph 950 viewBox — the
 *  anchors the pipeline places arrows on (same values as extract-half-glyphs). */
export const POINT = {
  [GridLocation.EAST]: { x: 618.1, y: 475 },
  [GridLocation.SOUTHEAST]: { x: 618.1, y: 618.1 },
  [GridLocation.CENTER]: { x: 475, y: 475 },
};

/** shouldMirrorArrow's table (arrow-positioning-orchestrator.ts): anti
 *  mirrors when the prop rotates cw, everything else when ccw. */
export function seedMirrored(motionType, rot) {
  const cw = rot === CW;
  return motionType === MotionType.ANTI ? cw : !cw;
}

/** Every halvable turns value per motion type. dash/static have no fl turns
 *  (scripts/half-domain-coverage.mjs is the authority). */
export const FAMILY_TURNS = {
  [MotionType.PRO]: [0, 0.5, 1, 1.5, 2, 2.5, 3, "fl"],
  [MotionType.ANTI]: [0, 0.5, 1, 1.5, 2, 2.5, 3, "fl"],
  [MotionType.DASH]: [0, 0.5, 1, 1.5, 2, 2.5, 3],
  [MotionType.STATIC]: [0, 0.5, 1, 1.5, 2, 2.5, 3],
};

const FAMILY_SHAPE = {
  [MotionType.PRO]: { start: GridLocation.EAST, end: GridLocation.SOUTH, rot: CW },
  [MotionType.ANTI]: { start: GridLocation.EAST, end: GridLocation.SOUTH, rot: CCW },
  [MotionType.DASH]: { start: GridLocation.SOUTH, end: GridLocation.NORTH, rot: CCW },
  [MotionType.STATIC]: { start: GridLocation.EAST, end: GridLocation.EAST, rot: CCW },
};

export const turnsKey = (turns) => (turns === "fl" ? "fl" : turns.toFixed(1));
export const assetName = (mt, turns) => `${mt}_half_${turnsKey(turns)}`;

/**
 * Build the seed record for one family: the canonical motion, its halved
 * step, and the exact transform parameters the pipeline renders it with
 * (anchor H, rotation R, mirror flag). Throws if the family can't be halved —
 * every family in FAMILY_TURNS is engine-legal, so a throw means the engine
 * changed underneath this table.
 */
export function familySeed(mt, turns) {
  const shape = FAMILY_SHAPE[mt];
  const full = {
    id: `seed-${mt}-${turns}`,
    letter: null,
    stepNumber: 1,
    gridMode: GridMode.DIAMOND,
    motions: {
      blue: createPlaceholderMotion(MotionColor.BLUE, {
        location: GridLocation.EAST,
        orientation: Orientation.IN,
      }),
      red: createMotionData({
        motionType: mt,
        rotationDirection: shape.rot,
        startLocation: shape.start,
        endLocation: shape.end,
        startOrientation: Orientation.IN,
        endOrientation: Orientation.IN,
        turns,
        color: MotionColor.RED,
        propType: PropType.STAFF,
        gridMode: GridMode.DIAMOND,
      }),
    },
  };
  const half = buildHalvedStep(full, 0.5);
  if (!half) throw new Error(`familySeed(${mt}, ${turns}): buildHalvedStep returned null`);
  const red = half.motions.red;
  const H = POINT[red.endLocation];
  if (!H) throw new Error(`familySeed(${mt}, ${turns}): no anchor coords for ${red.endLocation}`);
  return {
    mt,
    turns,
    key: `${mt}_t${turns}`,
    asset: assetName(mt, turns),
    start: shape.start,
    end: shape.end,
    rot: shape.rot,
    mid: red.endLocation,
    midOrientation: red.endOrientation,
    H,
    R: calculateSegmentRotation(red.endOrientation, red.endLocation, red.startLocation),
    mirrored: seedMirrored(mt, shape.rot),
    halfStep: half,
  };
}

/** All 30 legal families, in matrix order. */
export function allFamilySeeds() {
  return Object.entries(FAMILY_TURNS).flatMap(([mt, list]) =>
    list.map((t) => familySeed(mt, t))
  );
}
