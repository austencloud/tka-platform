/**
 * Level Feature Detector
 *
 * Scans a sequence for features that place it above Level 3 - the highest
 * level the runtime `SequenceDifficultyCalculator` currently classifies.
 *
 * This is an *escape hatch*, not a classifier. When `beyondLevel3` is true,
 * the caller should treat level as unknown rather than guessing L1.
 *
 * Features checked:
 *   L4 - center grid location ("c"), tau/terra positions, centric grid mode,
 *        hash motions, skew modifier on dash
 *   L5 - zeta/eta positions, skewed or 8point grid mode, skew modifier on shift
 *   L6 - interradial orientations (clockIn, clockOut, counterIn, counterOut)
 *   L7 - trigrid grid mode (conjoined)
 *   L8 - any motion/step carrying a `plane` field
 *
 * Feature lists come from:
 *   - src/lib/shared/pictograph/grid/domain/enums/grid-enums.ts
 *   - src/lib/shared/pictograph/shared/domain/enums/pictograph-enums.ts
 *   - packages/domain/src/curriculum/knowledge-graph.ts
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";

const CENTER_ORIENTATIONS = new Set([
  "centerN", "centerNE", "centerE", "centerSE",
  "centerS", "centerSW", "centerW", "centerNW",
]);

const INTERRADIAL_ORIENTATIONS = new Set([
  "clockIn", "clockOut", "counterIn", "counterOut",
]);

const HIGH_LEVEL_GRID_MODES = new Set([
  "centric", "skewed", "8point", "trigrid",
]);

const HASH_MOTION_TYPES = new Set(["hashIn", "hashOut"]);

export interface LevelFeatureReport {
  readonly beyondLevel3: boolean;
  readonly minLevel: number;
  readonly features: readonly string[];
}

interface MotionLike {
  startLocation?: string;
  endLocation?: string;
  startOrientation?: string;
  endOrientation?: string;
  motionType?: string;
  skewDirection?: string;
  skew?: string;
  plane?: string;
}

interface StepLike {
  startPosition?: string;
  endPosition?: string;
  motions?: Record<string, MotionLike | undefined>;
  plane?: string;
}

export function detectLevelFeatures(sequence: SequenceData): LevelFeatureReport {
  const features: string[] = [];
  let minLevel = 1;

  const note = (level: number, feature: string) => {
    features.push(feature);
    if (level > minLevel) minLevel = level;
  };

  if (sequence.gridMode && HIGH_LEVEL_GRID_MODES.has(sequence.gridMode)) {
    const mode = sequence.gridMode;
    if (mode === "centric") note(4, `gridMode:${mode}`);
    else if (mode === "skewed" || mode === "8point") note(5, `gridMode:${mode}`);
    else if (mode === "trigrid") note(7, `gridMode:${mode}`);
  }

  for (const step of sequence.steps as readonly StepData[]) {
    scanStep(step as unknown as StepLike, note);
  }

  return {
    beyondLevel3: minLevel >= 4,
    minLevel,
    features,
  };
}

function scanStep(step: StepLike, note: (level: number, feature: string) => void): void {
  if (step.plane) note(8, `step.plane:${step.plane}`);

  if (step.startPosition) scanPosition(step.startPosition, note);
  if (step.endPosition) scanPosition(step.endPosition, note);

  const motions = step.motions ?? {};
  for (const color of Object.keys(motions)) {
    const motion = motions[color];
    if (motion) scanMotion(motion, color, note);
  }
}

function scanPosition(position: string, note: (level: number, feature: string) => void): void {
  if (position.startsWith("zeta")) note(5, `position:${position}`);
  else if (position.startsWith("eta")) note(5, `position:${position}`);
  else if (position.startsWith("tau")) note(4, `position:${position}`);
  else if (position.startsWith("terra")) note(4, `position:${position}`);
}

function scanMotion(
  motion: MotionLike,
  color: string,
  note: (level: number, feature: string) => void,
): void {
  if (motion.startLocation === "c") note(4, `${color}.startLocation:center`);
  if (motion.endLocation === "c") note(4, `${color}.endLocation:center`);

  if (motion.motionType && HASH_MOTION_TYPES.has(motion.motionType)) {
    note(4, `${color}.motionType:${motion.motionType}`);
  }

  for (const ori of [motion.startOrientation, motion.endOrientation]) {
    if (!ori) continue;
    if (INTERRADIAL_ORIENTATIONS.has(ori)) note(6, `${color}.orientation:${ori}`);
    else if (CENTER_ORIENTATIONS.has(ori)) note(4, `${color}.orientation:${ori}`);
  }

  const skew = motion.skewDirection ?? motion.skew;
  if (skew === "+" || skew === "-") {
    const type = motion.motionType ?? "";
    if (type === "dash") note(4, `${color}.dash${skew}`);
    else note(5, `${color}.skew${skew}`);
  }

  if (motion.plane) note(8, `${color}.plane:${motion.plane}`);
}
