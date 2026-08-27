/**
 * Snapshot Capture Utility — 3D Hierarchy Regression Safety Net
 *
 * Feeds known PropState3D values through the CURRENT transform pipeline
 * and writes JSON fixtures. Task 2 asserts that the NEW PerformerRig
 * hierarchy produces identical values.
 *
 * Run: npx tsx tests/unit/3d-hierarchy/capture-snapshots.ts
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Vector3, Quaternion } from "three";

// Use relative imports so tsx resolves without $lib alias config
import { Plane } from "../../../src/lib/shared/3d/domain/enums/Plane.ts";
import {
  planeAngleToWorldPosition,
  calculatePropQuaternion,
} from "../../../src/lib/shared/3d/domain/constants/plane-transforms.ts";
import {
  computePropPosition,
  computePropRotation,
} from "../../../src/lib/shared/3d/components/props/prop3d-transforms.ts";
import type { PropState3D } from "../../../src/lib/shared/3d/domain/models/PropState3D.ts";


/** staffLength 0.95 * HAND_RADIUS_STAFF_RATIO 0.6 */
const GRID_RADIUS = 0.57;

/**
 * Shoulder height for a 190.5 cm performer.
 * heightCm * 0.82 * 0.01 = 1.5621 m
 */
const SHOULDER_HEIGHT = 190.5 * 0.82 * 0.01; // ≈ 1.5621

/** Half the staff length — used only for documentation / context */
const STAFF_HALF = 0.95 / 2; // 0.475

/** Location angles: canvas Y-down convention (E=0, S=π/2, W=π, N=3π/2) */
const LOC = {
  N: (3 * Math.PI) / 2, // -π/2 equivalent
  E: 0,
  S: Math.PI / 2,
  W: Math.PI,
};


interface PropSnapshot {
  /** Human-readable label e.g. "blue@N" */
  label: string;
  /** Input angle passed to planeAngleToWorldPosition */
  inputAngle: number;
  /** Input staffAngle passed to calculatePropQuaternion */
  inputStaffAngle: number;
  /** Which plane */
  plane: string;
  /** Output of computePropPosition — world-space XYZ */
  propCenter: [number, number, number];
  /** Output of computePropRotation — Euler XYZ (radians) */
  propRotation: [number, number, number];
  /** Whether facing transform was skipped */
  skipFacingTransform: boolean;
  /** Lateral X offset applied to worldPosition before passing to computePropPosition */
  lateralOffset: number;
}

interface StepSnapshot {
  /** progress value (0–1) used to lerp between start and end for this beat */
  progress: number;
  blue: PropSnapshot;
  red: PropSnapshot;
}

interface Snapshot {
  label: string;
  planeMode: string;
  facingAngle: number;
  avatarPosition: { x: number; y: number; z: number };
  gridOffset: number;
  beats: StepSnapshot[];
}


/**
 * Build a minimal PropState3D so we can feed it through computePropPosition
 * and computePropRotation without the full animation interpolation stack.
 */
function makePropState(
  plane: Plane,
  angle: number,
  staffAngle: number,
  lateralOffset: number,
  skipFacingTransform: boolean
): PropState3D {
  const worldPosition = planeAngleToWorldPosition(plane, angle, GRID_RADIUS);
  // Apply lateral X offset (avatar-local space) — mirrors Viewer3DScene logic
  worldPosition.x += lateralOffset;
  const worldRotation = calculatePropQuaternion(plane, staffAngle);

  return {
    centerPathAngle: angle,
    staffRotationAngle: staffAngle,
    plane,
    worldPosition,
    worldRotation,
    skipFacingTransform,
  };
}

/**
 * Capture a single PropSnapshot by running the current pipeline.
 */
function captureOneProp(
  label: string,
  plane: Plane,
  angle: number,
  staffAngle: number,
  lateralOffset: number,
  skipFacingTransform: boolean,
  avatarPosition: { x: number; y: number; z: number },
  facingAngle: number,
  gridOffset: number
): PropSnapshot {
  const propState = makePropState(
    plane,
    angle,
    staffAngle,
    lateralOffset,
    skipFacingTransform
  );

  const propCenter = computePropPosition(
    propState,
    avatarPosition,
    facingAngle,
    gridOffset
  );

  const propRotation = computePropRotation(propState, facingAngle);

  return {
    label,
    inputAngle: angle,
    inputStaffAngle: staffAngle,
    plane: plane as string,
    propCenter,
    propRotation,
    skipFacingTransform,
    lateralOffset,
  };
}


/**
 * Wall mode: both props spin on the WALL plane in front of the performer.
 * gridOffset = 0.3 m pushes the grid forward from the body center.
 *
 * Two test cases:
 *   Case A — Blue at N, Red at S (opposite endpoints of a vertical line)
 *   Case B — Blue at E, Red at W (opposite endpoints of a horizontal line)
 *
 * Five progress values sample the full arc so we can assert interpolated
 * positions in addition to the endpoints.
 */
function captureWallMode(): Snapshot[] {
  const facingAngle = 0;
  const avatarPosition = { x: 0, y: SHOULDER_HEIGHT, z: 0 };
  const gridOffset = 0.3;

  const progressValues = [0, 0.25, 0.5, 0.75, 1.0];

  function makeCase(
    caseLabel: string,
    blueStartAngle: number,
    blueEndAngle: number,
    redStartAngle: number,
    redEndAngle: number
  ): Snapshot {
    const beats: StepSnapshot[] = progressValues.map((progress) => {
      // Linear interpolation of angles for this sample
      const blueAngle = blueStartAngle + (blueEndAngle - blueStartAngle) * progress;
      const redAngle = redStartAngle + (redEndAngle - redStartAngle) * progress;

      // Staff angle: prop points toward center (IN orientation) as default.
      // In → angle points opposite of location (angle + π).
      const blueStaffAngle = blueAngle + Math.PI;
      const redStaffAngle = redAngle + Math.PI;

      return {
        progress,
        blue: captureOneProp(
          `blue@${progress.toFixed(2)}`,
          Plane.WALL,
          blueAngle,
          blueStaffAngle,
          0,
          false,
          avatarPosition,
          facingAngle,
          gridOffset
        ),
        red: captureOneProp(
          `red@${progress.toFixed(2)}`,
          Plane.WALL,
          redAngle,
          redStaffAngle,
          0,
          false,
          avatarPosition,
          facingAngle,
          gridOffset
        ),
      };
    });

    return {
      label: `wall-mode-${caseLabel}`,
      planeMode: "WALL",
      facingAngle,
      avatarPosition,
      gridOffset,
      beats,
    };
  }

  return [
    // Case A: Blue sweeps N→S, Red sweeps S→N (vertical axis flip)
    makeCase("case-a-vertical", LOC.N, LOC.S, LOC.S, LOC.N),
    // Case B: Blue sweeps E→W, Red sweeps W→E (horizontal axis flip)
    makeCase("case-b-horizontal", LOC.E, LOC.W, LOC.W, LOC.E),
  ];
}

// ── Dual Wheel Mode Capture ───────────────────────────────────────────────────

/**
 * Dual wheel mode: each prop spins on its own WHEEL plane.
 * The planes are offset laterally (±0.4 m) from body center.
 * skipFacingTransform = true — world positions are already correct.
 *
 * Blue prop: lateral offset +0.4 (performer's left in avatar-local space)
 * Red prop:  lateral offset -0.4 (performer's right)
 *
 * Both props start at N (top of the wheel) and travel to S (bottom).
 */
function captureDualWheelMode(): Snapshot[] {
  const facingAngle = 0;
  const avatarPosition = { x: 0, y: SHOULDER_HEIGHT, z: 0 };
  const gridOffset = 0; // no forward offset in dual wheel
  const blueLateralOffset = 0.4;
  const redLateralOffset = -0.4;

  const progressValues = [0, 0.25, 0.5, 0.75, 1.0];

  const beats: StepSnapshot[] = progressValues.map((progress) => {
    // Blue: N → S on its wheel plane
    const blueAngle = LOC.N + (LOC.S - LOC.N) * progress;
    const blueStaffAngle = blueAngle + Math.PI;

    // Red: S → N (opposite direction)
    const redAngle = LOC.S + (LOC.N - LOC.S) * progress;
    const redStaffAngle = redAngle + Math.PI;

    return {
      progress,
      blue: captureOneProp(
        `blue@${progress.toFixed(2)}`,
        Plane.WHEEL,
        blueAngle,
        blueStaffAngle,
        blueLateralOffset,
        true, // skipFacingTransform
        avatarPosition,
        facingAngle,
        gridOffset
      ),
      red: captureOneProp(
        `red@${progress.toFixed(2)}`,
        Plane.WHEEL,
        redAngle,
        redStaffAngle,
        redLateralOffset,
        true, // skipFacingTransform
        avatarPosition,
        facingAngle,
        gridOffset
      ),
    };
  });

  return [
    {
      label: "dual-wheel-mode",
      planeMode: "DUAL_WHEEL",
      facingAngle,
      avatarPosition,
      gridOffset,
      beats,
    },
  ];
}

// ── Museum Mode Capture ───────────────────────────────────────────────────────

/**
 * Museum mode: same as wall mode but the avatar stands on a raised platform.
 * avatarPosition.y = SHOULDER_HEIGHT + 0.3 (museum platform elevation).
 *
 * Three progress values — just enough to catch a position drift between
 * wall mode and museum mode.
 */
function captureMuseumMode(): Snapshot[] {
  const facingAngle = 0;
  const platformElevation = 0.3;
  const avatarPosition = { x: 0, y: SHOULDER_HEIGHT + platformElevation, z: 0 };
  const gridOffset = 0.3;

  const progressValues = [0, 0.5, 1.0];

  function makeCase(
    caseLabel: string,
    blueStartAngle: number,
    blueEndAngle: number,
    redStartAngle: number,
    redEndAngle: number
  ): Snapshot {
    const beats: StepSnapshot[] = progressValues.map((progress) => {
      const blueAngle = blueStartAngle + (blueEndAngle - blueStartAngle) * progress;
      const redAngle = redStartAngle + (redEndAngle - redStartAngle) * progress;
      const blueStaffAngle = blueAngle + Math.PI;
      const redStaffAngle = redAngle + Math.PI;

      return {
        progress,
        blue: captureOneProp(
          `blue@${progress.toFixed(2)}`,
          Plane.WALL,
          blueAngle,
          blueStaffAngle,
          0,
          false,
          avatarPosition,
          facingAngle,
          gridOffset
        ),
        red: captureOneProp(
          `red@${progress.toFixed(2)}`,
          Plane.WALL,
          redAngle,
          redStaffAngle,
          0,
          false,
          avatarPosition,
          facingAngle,
          gridOffset
        ),
      };
    });

    return {
      label: `museum-${caseLabel}`,
      planeMode: "WALL",
      facingAngle,
      avatarPosition,
      gridOffset,
      beats,
    };
  }

  return [
    makeCase("case-a-vertical", LOC.N, LOC.S, LOC.S, LOC.N),
    makeCase("case-b-horizontal", LOC.E, LOC.W, LOC.W, LOC.E),
  ];
}

// ── Write Fixtures ────────────────────────────────────────────────────────────

function round6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}

function roundSnapshot(s: Snapshot): Snapshot {
  return {
    ...s,
    avatarPosition: {
      x: round6(s.avatarPosition.x),
      y: round6(s.avatarPosition.y),
      z: round6(s.avatarPosition.z),
    },
    beats: s.beats.map((b) => ({
      ...b,
      blue: roundPropSnapshot(b.blue),
      red: roundPropSnapshot(b.red),
    })),
  };
}

function roundPropSnapshot(p: PropSnapshot): PropSnapshot {
  return {
    ...p,
    inputAngle: round6(p.inputAngle),
    inputStaffAngle: round6(p.inputStaffAngle),
    propCenter: p.propCenter.map(round6) as [number, number, number],
    propRotation: p.propRotation.map(round6) as [number, number, number],
  };
}

const __filename = fileURLToPath(import.meta.url);
const __dir = dirname(__filename);
const FIXTURES_DIR = resolve(__dir, "fixtures");

mkdirSync(FIXTURES_DIR, { recursive: true });

const wallSnapshots = captureWallMode().map(roundSnapshot);
const dualWheelSnapshots = captureDualWheelMode().map(roundSnapshot);
const museumSnapshots = captureMuseumMode().map(roundSnapshot);

writeFileSync(
  resolve(FIXTURES_DIR, "wall-mode-snapshots.json"),
  JSON.stringify(wallSnapshots, null, 2)
);

writeFileSync(
  resolve(FIXTURES_DIR, "dual-wheel-snapshots.json"),
  JSON.stringify(dualWheelSnapshots, null, 2)
);

writeFileSync(
  resolve(FIXTURES_DIR, "museum-snapshots.json"),
  JSON.stringify(museumSnapshots, null, 2)
);

console.log("Snapshots written:");
console.log(`  wall-mode-snapshots.json    — ${wallSnapshots.length} scenarios, ${wallSnapshots[0]?.beats.length} beats each`);
console.log(`  dual-wheel-snapshots.json   — ${dualWheelSnapshots.length} scenarios, ${dualWheelSnapshots[0]?.beats.length} beats each`);
console.log(`  museum-snapshots.json       — ${museumSnapshots.length} scenarios, ${museumSnapshots[0]?.beats.length} beats each`);

// Spot-check: print first beat of wall mode case A
const wallA = wallSnapshots[0];
if (wallA) {
  const beat0 = wallA.beats[0];
  if (beat0) {
    console.log("\nSpot check — wall-mode case A, progress=0:");
    console.log("  blue propCenter:", beat0.blue.propCenter);
    console.log("  red  propCenter:", beat0.red.propCenter);
    console.log("  blue propRotation:", beat0.blue.propRotation);
  }
}

const wallMid = wallSnapshots[0]?.beats[2]; // progress=0.5
if (wallMid) {
  console.log("\nSpot check — wall-mode case A, progress=0.5:");
  console.log("  blue propCenter:", wallMid.blue.propCenter);
  console.log("  red  propCenter:", wallMid.red.propCenter);
}

const dualBeat0 = dualWheelSnapshots[0]?.beats[0];
if (dualBeat0) {
  console.log("\nSpot check — dual-wheel, progress=0:");
  console.log("  blue propCenter:", dualBeat0.blue.propCenter);
  console.log("  red  propCenter:", dualBeat0.red.propCenter);
}
