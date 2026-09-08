// scripts/half-domain-coverage.mjs
// Run: npx tsx scripts/half-domain-coverage.mjs
//
// Systematic coverage map of the halved-motion domain: for every
// (motionType x turns x startOrientation x rotationDirection) combination,
// runs the REAL buildHalvedStep + getArrowSvgPath and reports one of:
//   COVERED  — halvable, and its resolved arrow asset file exists
//   MISSING  — halvable, but the resolved asset is a fallback/absent file
//              (renders the wrong turns' art or nothing) -> needs drawn art
//   BLOCKED  — buildHalvedStep returns null (off-lattice orientation, float,
//              skew, center-touching hash...) -> needs pipeline work first,
//              not art
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { buildHalvedStep } from "../src/lib/shared/animation-engine/services/build-halved-step.ts";
import { getArrowSvgPath } from "../src/lib/shared/pictograph/arrow/rendering/services/arrow-path-resolver.ts";
import {
  createMotionData,
  createPlaceholderMotion,
} from "../src/lib/shared/pictograph/shared/domain/models/motion-data.ts";
import { GridMode, GridLocation } from "../src/lib/shared/pictograph/grid/domain/enums/grid-enums.ts";
import { PropType } from "../src/lib/shared/pictograph/prop/domain/enums/prop-type.ts";
import {
  MotionType,
  HandSide,
  Orientation,
  RotationDirection,
} from "../src/lib/shared/pictograph/shared/domain/enums/pictograph-enums.ts";

const { EAST: E, SOUTH: S, NORTH: N } = GridLocation;
const CW = RotationDirection.CLOCKWISE;
const CCW = RotationDirection.COUNTER_CLOCKWISE;

// Representative motion per type (locations don't change halvability class —
// rotation generalizes across the ring; center-touching hash is listed
// separately below).
const SHAPES = {
  [MotionType.PRO]: { from: E, to: S },
  [MotionType.ANTI]: { from: E, to: S },
  [MotionType.DASH]: { from: S, to: N },
  [MotionType.STATIC]: { from: E, to: E },
};

const TURNS = [0, 0.5, 1, 1.5, 2, 2.5, 3, "fl"];
const START_ORIS = [Orientation.IN, Orientation.CLOCK];
const ROTS = [CW, CCW];

const step = (mt, turns, startOri, rot) => {
  const { from, to } = SHAPES[mt];
  return {
    id: `cov-${mt}-${turns}-${startOri}-${rot}`,
    letter: null,
    stepNumber: 1,
    gridMode: GridMode.DIAMOND,
    motions: {
      left: createPlaceholderMotion(HandSide.LEFT, { location: E, orientation: Orientation.IN }),
      right: createMotionData({
        motionType: mt,
        rotationDirection: rot,
        startLocation: from,
        endLocation: to,
        startOrientation: startOri,
        // endOrientation is declarative input; the halfway state is engine-
        // computed. IN is a safe placeholder across the sweep.
        endOrientation: Orientation.IN,
        turns,
        hand: HandSide.RIGHT,
        propType: PropType.STAFF,
        gridMode: GridMode.DIAMOND,
      }),
    },
  };
};

const rows = [];
for (const mt of Object.keys(SHAPES)) {
  for (const turns of TURNS) {
    for (const startOri of START_ORIS) {
      for (const rot of ROTS) {
        let half = null;
        let err = "";
        try {
          half = buildHalvedStep(step(mt, turns, startOri, rot), 0.5);
        } catch (e) {
          err = String(e?.message ?? e);
        }
        if (!half) {
          rows.push({ mt, turns, startOri, rot, status: "BLOCKED", detail: err || "buildHalvedStep -> null" });
          continue;
        }
        const asset = getArrowSvgPath(half.motions.right);
        const onDisk = existsSync(resolve(process.cwd(), `static${asset}`));
        const perTurn = /_half_[\d.]+\.svg$/.test(asset);
        const status = onDisk && perTurn ? "COVERED" : onDisk ? "MISSING(art: falls back to bare _half)" : "MISSING(no file)";
        rows.push({ mt, turns, startOri, rot, status, detail: asset });
      }
    }
  }
}

// Collapse identical (status, detail) across rot/startOri for readability.
const byCombo = new Map();
for (const r of rows) {
  const key = `${r.mt}|${r.turns}|${r.status}|${r.detail}`;
  if (!byCombo.has(key)) byCombo.set(key, { ...r, variants: [] });
  byCombo.get(key).variants.push(`${r.startOri}/${r.rot}`);
}

let lastMt = "";
for (const r of byCombo.values()) {
  if (r.mt !== lastMt) {
    console.log(`\n== ${r.mt.toUpperCase()} ==`);
    lastMt = r.mt;
  }
  console.log(
    `turns=${String(r.turns).padEnd(4)} [${r.variants.join(", ").padEnd(40)}] ${r.status}` +
      (r.status !== "COVERED" ? ` — ${r.detail}` : "")
  );
}

// Known separately-blocked families (guards in buildHalvedStep, listed here so
// the report is the one place holes live):
console.log(`\n== STRUCTURAL (guards, not turns) ==`);
console.log("FLOAT motion type            BLOCKED — buildHalvedStep nulls floats");
console.log("skewSteps/skewDir set        BLOCKED — halve-vs-skew composition undefined in v1");
console.log("hash (center-touching dash)  BLOCKED — no named midpoint location");
console.log("quarters (t=0.25/0.75)       BLOCKED — legal orientation, no named grid location (spec §7)");
