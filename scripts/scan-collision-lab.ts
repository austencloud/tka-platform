/**
 * scan-collision-lab.ts
 *
 * Batch-run the stance optimizer on every pose in the 576-pose diamond
 * in/out catalog and write a JSON report showing which poses the AI
 * can solve and which it can't. Run from the terminal:
 *
 *   npx tsx scripts/scan-collision-lab.ts
 *   npx tsx scripts/scan-collision-lab.ts --height 1.85
 *   npx tsx scripts/scan-collision-lab.ts --out scan.json --verbose
 *
 * Output format:
 *
 *   {
 *     generatedAt: 2026-04-11T…,
 *     heightM: 1.70,
 *     totalPoses: 576,
 *     feasibleCount: 560,
 *     infeasibleCount: 16,
 *     infeasiblePoses: [
 *       { id: "wNi-hEo", loss: 73.4, reachShortfall: {blue: 0.03, red: 0.0}, ... },
 *       ...
 *     ]
 *   }
 *
 * The whole scan runs in a few seconds. Feed the `infeasiblePoses` array
 * back to Claude if the optimizer is consistently failing on real TKA
 * configurations — it contains everything needed to debug the math.
 */

import { writeFileSync } from "fs";
import { resolve } from "path";
import { Vector3, Quaternion, Euler } from "three";

import { DiamondPoseEnumerator } from "../src/lib/features/lab/tabs/collision-lab/services/implementations/DiamondPoseEnumerator";
import {
  StanceSimulator,
  restPoseFromHeight,
} from "../src/lib/features/lab/tabs/collision-lab/services/implementations/StanceSimulator";
import { StanceOptimizer } from "../src/lib/features/lab/tabs/collision-lab/services/implementations/StanceOptimizer";
import { PlaneCoordinateMapper } from "../src/lib/shared/3d/services/implementations/PlaneCoordinateMapper";
import { OrientationMapper } from "../src/lib/shared/3d/services/implementations/OrientationMapper";
import { GridLocation } from "../src/lib/shared/pictograph/grid/domain/enums/grid-enums";
import { Orientation } from "../src/lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { LOCATION_ANGLES } from "../src/lib/features/compose/shared/domain/math-constants";
import { STAGE } from "../src/lib/shared/3d/scale/scale-constants";
import { STANCE_BOUNDS } from "../src/lib/features/lab/tabs/collision-lab/domain/types";
import type {
  DiamondPosition,
  HandOrientation,
  PoseDefinition,
} from "../src/lib/features/lab/tabs/collision-lab/domain/types";
import type {
  OptimizerBounds,
  OptimizerInput,
} from "../src/lib/features/lab/tabs/collision-lab/services/contracts/IStanceOptimizer";
import type { SimPropTarget } from "../src/lib/features/lab/tabs/collision-lab/services/contracts/IStanceSimulator";
import { Plane } from "../src/lib/shared/3d/domain/enums/Plane";

// Argument parsing

interface Args {
  heightM: number;
  outputPath: string;
  verbose: boolean;
}

function parseArgs(): Args {
  const args: Args = {
    heightM: 1.7,
    outputPath: "collision-lab-scan.json",
    verbose: false,
  };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--height" && argv[i + 1]) {
      args.heightM = parseFloat(argv[++i]!);
    } else if (a === "--out" && argv[i + 1]) {
      args.outputPath = argv[++i]!;
    } else if (a === "--verbose" || a === "-v") {
      args.verbose = true;
    } else if (a === "--help" || a === "-h") {
      console.log(
        "Usage: npx tsx scripts/scan-collision-lab.ts [--height M] [--out FILE] [--verbose]"
      );
      process.exit(0);
    }
  }
  return args;
}

// Duplicate of poseToOptimizerInput from the state factory. Lives here
// so this script doesn't have to import a .svelte.ts file (which tsx
// can't compile directly).

const STAFF_HALF_LENGTH = 0.43;
const STAFF_RADIUS = 0.012;
const STAFF_HORIZONTAL_QUAT = new Quaternion().setFromEuler(
  new Euler(0, 0, Math.PI / 2)
);

const POSITION_TO_GRID: Record<DiamondPosition, GridLocation> = {
  N: GridLocation.NORTH,
  E: GridLocation.EAST,
  S: GridLocation.SOUTH,
  W: GridLocation.WEST,
};

const planeMapper = new PlaneCoordinateMapper();
const orientationMapper = new OrientationMapper();

function handToPropTarget(
  plane: Plane,
  position: DiamondPosition,
  orientation: HandOrientation
): SimPropTarget {
  const loc = POSITION_TO_GRID[position];
  const centerPathAngle = LOCATION_ANGLES[loc];
  const staffAngle = orientationMapper.mapOrientationToAngle(
    orientation === "in" ? Orientation.IN : Orientation.OUT,
    centerPathAngle
  );
  const local = planeMapper.gridLocationToPosition3D(plane, loc);
  const worldRotation = planeMapper.calculatePropRotation(plane, staffAngle);
  const axis = new Vector3(0, 1, 0)
    .applyQuaternion(STAFF_HORIZONTAL_QUAT)
    .applyQuaternion(worldRotation)
    .multiplyScalar(STAFF_HALF_LENGTH);
  const grip = new Vector3(
    local.x,
    local.y,
    local.z + STAGE.AVATAR_GRID_OFFSET
  );
  return {
    gripWorld: grip,
    tipAWorld: grip.clone().add(axis),
    tipBWorld: grip.clone().sub(axis),
    radius: STAFF_RADIUS,
  };
}

function poseToOptimizerInput(pose: PoseDefinition): OptimizerInput {
  return {
    blue: handToPropTarget(
      pose.blueHand.plane,
      pose.blueHand.position,
      pose.blueHand.orientation
    ),
    red: handToPropTarget(
      pose.redHand.plane,
      pose.redHand.position,
      pose.redHand.orientation
    ),
  };
}

const BOUNDS: OptimizerBounds = {
  footOffsetX: {
    min: STANCE_BOUNDS.footOffset.min,
    max: STANCE_BOUNDS.footOffset.max,
  },
  footOffsetZ: {
    min: STANCE_BOUNDS.footOffset.min,
    max: STANCE_BOUNDS.footOffset.max,
  },
  rootYawRad: {
    min: (STANCE_BOUNDS.rootYawDeg.min * Math.PI) / 180,
    max: (STANCE_BOUNDS.rootYawDeg.max * Math.PI) / 180,
  },
  spinePitchRad: {
    min: (STANCE_BOUNDS.spinePitchDeg.min * Math.PI) / 180,
    max: (STANCE_BOUNDS.spinePitchDeg.max * Math.PI) / 180,
  },
  torsoTwistRad: {
    min: (STANCE_BOUNDS.torsoTwistDeg.min * Math.PI) / 180,
    max: (STANCE_BOUNDS.torsoTwistDeg.max * Math.PI) / 180,
  },
};

// Main

function main() {
  const args = parseArgs();
  console.log(`Scanning collision lab catalog at height ${args.heightM} m…`);

  const enumerator = new DiamondPoseEnumerator();
  const poses = enumerator.enumerateDiamondInOut();
  const simulator = new StanceSimulator(restPoseFromHeight(args.heightM));
  const optimizer = new StanceOptimizer(simulator);

  const neutral = {
    footOffsetX: 0,
    footOffsetZ: 0,
    rootYawRad: 0,
    spinePitchRad: 0,
  };

  const startTime = Date.now();
  const infeasible: Array<{
    id: string;
    index: number;
    blueHand: PoseDefinition["blueHand"];
    redHand: PoseDefinition["redHand"];
    loss: number;
    evaluations: number;
    reachShortfallCm: { blue: number; red: number };
    balanceMarginCm: number;
    stance: {
      footOffsetX: number;
      footOffsetZ: number;
      rootYawDeg: number;
      spinePitchDeg: number;
    };
    collisions: Array<{
      zone: string;
      depthCm: number;
      description: string;
    }>;
  }> = [];

  let feasibleCount = 0;
  for (let i = 0; i < poses.length; i++) {
    const pose = poses[i]!;
    const input = poseToOptimizerInput(pose);
    const result = optimizer.optimize(input, neutral, BOUNDS);
    if (result.feasible) {
      feasibleCount++;
      if (args.verbose) {
        process.stdout.write(
          `[${i + 1}/${poses.length}] ${pose.id} ✓ loss ${result.loss.toFixed(2)}\n`
        );
      }
    } else {
      infeasible.push({
        id: pose.id,
        index: i,
        blueHand: pose.blueHand,
        redHand: pose.redHand,
        loss: result.loss,
        evaluations: result.evaluations,
        reachShortfallCm: {
          blue: result.simResult.reachShortfall.blue * 100,
          red: result.simResult.reachShortfall.red * 100,
        },
        balanceMarginCm: result.simResult.balanceMargin * 100,
        stance: {
          footOffsetX: result.stance.footOffsetX,
          footOffsetZ: result.stance.footOffsetZ,
          rootYawDeg: (result.stance.rootYawRad * 180) / Math.PI,
          spinePitchDeg: (result.stance.spinePitchRad * 180) / Math.PI,
        },
        collisions: result.simResult.collisions.map((c) => ({
          zone: c.zone,
          depthCm: c.depth * 100,
          description: c.description,
        })),
      });
      if (args.verbose) {
        process.stdout.write(
          `[${i + 1}/${poses.length}] ${pose.id} ✗ loss ${result.loss.toFixed(2)}\n`
        );
      }
    }
    if (!args.verbose && (i + 1) % 48 === 0) {
      process.stdout.write(
        `  scanned ${i + 1}/${poses.length} (${infeasible.length} infeasible so far)\n`
      );
    }
  }

  const elapsed = Date.now() - startTime;

  const report = {
    generatedAt: new Date().toISOString(),
    heightM: args.heightM,
    totalPoses: poses.length,
    feasibleCount,
    infeasibleCount: infeasible.length,
    elapsedMs: elapsed,
    avgEvalsPerPose:
      infeasible.reduce((s, p) => s + p.evaluations, 0) / (poses.length || 1),
    infeasiblePoses: infeasible,
  };

  const outPath = resolve(args.outputPath);
  writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log("");
  console.log(`Scan complete in ${(elapsed / 1000).toFixed(1)} s`);
  console.log(
    `  ${feasibleCount}/${poses.length} feasible (${(
      (100 * feasibleCount) /
      poses.length
    ).toFixed(1)}%)`
  );
  console.log(
    `  ${infeasible.length}/${poses.length} INFEASIBLE (${(
      (100 * infeasible.length) /
      poses.length
    ).toFixed(1)}%)`
  );
  console.log(`  Report written to ${outPath}`);

  if (infeasible.length > 0 && infeasible.length <= 20) {
    console.log("");
    console.log("Infeasible poses:");
    for (const p of infeasible) {
      console.log(
        `  ${p.id.padEnd(10)} loss ${p.loss.toFixed(1).padStart(6)} | ` +
          `L reach ${p.reachShortfallCm.blue.toFixed(1).padStart(5)} cm | ` +
          `R reach ${p.reachShortfallCm.red.toFixed(1).padStart(5)} cm`
      );
    }
  }
}

main();
