/**
 * Shared data derivation for card back variants.
 * Extracts LOOP detection, level info, sequence anatomy, and labels
 * so each visual variant doesn't duplicate this logic.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { ISequenceToEntryConverter } from "../../services/contracts/ISequenceToEntryConverter";
import type { ILOOPExplainer, LOOPExplanation } from "../../services/contracts/ILOOPExplainer";
import { LOOPComponent } from "$lib/features/create/generate/shared/domain/models/generate-models";
import {
  LOOP_TYPE_LABELS,
  ROTATED_LOOP_TYPES,
} from "$lib/features/create/generate/circular/domain/models/circular-models";
import { LOOPTypeResolver } from "$lib/features/create/generate/shared/services/implementations/LOOPTypeResolver";

// The anatomy grid shows which elements appear in the sequence.
// Each field is a set of string values; the card renders present
// values as lit pills and absent values as grayed-out pills.
export interface SequenceAnatomy {
  positions: Set<string>;       // "alpha" | "beta" | "gamma"
  motions: Set<string>;         // "shift" | "dash" | "static"
  rotations: Set<string>;       // "cw" | "ccw" | "none"
  orientations: Set<string>;    // "in" | "out" | "clock" | "counter"
  turns: Set<string>;           // "0" | "0.5" | "1" | "1.5" | "2" | "2.5" | "3"
}

export interface LevelBadgeData {
  number: number;
  name: string;
  detail: string;
  reason: string;
  gradient: string;
  textColor: string;
}

export interface CardBackData {
  word: string;
  stepCount: number;
  level: LevelBadgeData;
  anatomy: SequenceAnatomy;
  hasLoop: boolean;
  loopComponents: Set<LOOPComponent>;
  loopLabel: string | null;
  loopExplanation: LOOPExplanation | null;
  sliceName: string | null;
  sliceDetail: string | null;
  isRotated: boolean;
  /** Starting position group: "alpha", "beta", "gamma", etc. */
  startPositionGroup: string | null;
}

// Level badge definitions with the actual gradients from the app's LevelCard
const LEVEL_BADGES: Record<number, Omit<LevelBadgeData, "reason">> = {
  1: {
    number: 1,
    name: "Foundation",
    detail: "No turns",
    gradient: `radial-gradient(ellipse at top left,
      rgb(186, 230, 253) 0%,
      rgb(125, 211, 252) 30%,
      rgb(56, 189, 248) 70%,
      rgb(14, 165, 233) 100%)`,
    textColor: "black",
  },
  2: {
    number: 2,
    name: "Turning",
    detail: "Whole turns",
    gradient: `radial-gradient(ellipse at top left,
      rgb(226, 232, 240) 0%,
      rgb(148, 163, 184) 30%,
      rgb(100, 116, 139) 70%,
      rgb(71, 85, 105) 100%)`,
    textColor: "white",
  },
  3: {
    number: 3,
    name: "Precision",
    detail: "Half turns and float",
    gradient: `radial-gradient(ellipse at top left,
      rgb(254, 240, 138) 0%,
      rgb(253, 224, 71) 20%,
      rgb(250, 204, 21) 40%,
      rgb(234, 179, 8) 60%,
      rgb(202, 138, 4) 80%,
      rgb(161, 98, 7) 100%)`,
    textColor: "black",
  },
};

// Use the same resolver as the front card so LOOP icons always match
const loopTypeResolver = new LOOPTypeResolver();

// Derive the "why this level" reason from the anatomy
function deriveLevelReason(level: number, anatomy: SequenceAnatomy): string {
  if (level >= 3) {
    const hasHalfTurns = ["0.5", "1.5", "2.5"].some((t) => anatomy.turns.has(t));
    const hasFloat = anatomy.motions.has("float");
    const hasClockCounter = anatomy.orientations.has("clock") || anatomy.orientations.has("counter");
    const reasons: string[] = [];
    if (hasHalfTurns) reasons.push("half-turn values");
    if (hasFloat) reasons.push("float");
    if (hasClockCounter) reasons.push("clock/counter orientations");
    return reasons.length > 0
      ? `Contains ${reasons.join(", ")}`
      : "Level 3 sequence";
  }
  if (level >= 2) {
    const wholeTurns = ["1", "2", "3"].filter((t) => anatomy.turns.has(t));
    return wholeTurns.length > 0
      ? `Contains ${wholeTurns.map((t) => t + "-turn").join(", ")} motions`
      : "Level 2 sequence";
  }
  return "All motions at 0 turns";
}

// Extract the anatomy by scanning every step's motion data
function deriveAnatomy(sequence: SequenceData): SequenceAnatomy {
  const positions = new Set<string>();
  const motions = new Set<string>();
  const rotations = new Set<string>();
  const orientations = new Set<string>();
  const turns = new Set<string>();

  // Helper to classify position strings like "alpha1", "beta5", "gamma13"
  function addPosition(pos: string | null | undefined) {
    if (!pos) return;
    if (pos.startsWith("alpha")) positions.add("alpha");
    else if (pos.startsWith("beta")) positions.add("beta");
    else if (pos.startsWith("gamma")) positions.add("gamma");
  }

  // Include start position
  if (sequence.startPosition) {
    const sp = sequence.startPosition;
    addPosition(sp.gridPosition as string | undefined);

    // Orientations from start position motions
    for (const motion of Object.values(sp.motions ?? {})) {
      if (!motion) continue;
      addOrientation(motion.startOrientation, orientations);
    }
  }

  for (const step of sequence.steps ?? []) {
    addPosition(step.startPosition as string | undefined);
    addPosition(step.endPosition as string | undefined);

    for (const motion of Object.values(step.motions ?? {})) {
      if (!motion) continue;

      // Motion type: pro and anti are both "shift"
      const mt = motion.motionType;
      if (mt === "pro" || mt === "anti") motions.add("shift");
      else if (mt === "dash") motions.add("dash");
      else if (mt === "static") motions.add("static");
      else if (mt === "float") motions.add("float");

      // Rotation direction
      const rd = motion.rotationDirection;
      if (rd === "cw") rotations.add("cw");
      else if (rd === "ccw") rotations.add("ccw");
      else if (rd === "noRotation") rotations.add("none");

      // Orientations
      addOrientation(motion.startOrientation, orientations);
      addOrientation(motion.endOrientation, orientations);

      // Turns
      const t = motion.turns;
      if (t === "fl") {
        motions.add("float");
      } else if (typeof t === "number") {
        turns.add(String(t));
      }
    }
  }

  return { positions, motions, rotations, orientations, turns };
}

function addOrientation(o: string | null | undefined, set: Set<string>) {
  if (!o) return;
  if (o === "in") set.add("in");
  else if (o === "out") set.add("out");
  else if (o === "clock" || o.startsWith("clock")) set.add("clock");
  else if (o === "counter" || o.startsWith("counter")) set.add("counter");
}

/**
 * Derive the starting position group from any available source:
 * explicit field, start position grid position, or first step.
 */
const POSITION_GROUPS = ["alpha", "beta", "gamma", "zeta", "eta", "tau", "terra"];

function extractGroup(positionString: string | null | undefined): string | null {
  if (!positionString) return null;
  const pos = String(positionString);
  for (const group of POSITION_GROUPS) {
    if (pos.startsWith(group)) return group;
  }
  return null;
}

/**
 * Derive the starting position group from any available source:
 * explicit field, start position data, or first step.
 */
function deriveStartPositionGroup(sequence: SequenceData): string | null {

  // Explicit field (most reliable when present)
  if (sequence.startingPositionGroup) return sequence.startingPositionGroup;

  // From StartPositionData — try gridPosition, endPosition, startPosition
  const sp = sequence.startPosition ?? sequence.startingPosition;
  if (sp) {
    const fromGrid = extractGroup(sp.gridPosition as string | undefined);
    if (fromGrid) return fromGrid;
    const fromEnd = extractGroup(sp.endPosition as string | undefined);
    if (fromEnd) return fromEnd;
    const fromStart = extractGroup(sp.startPosition as string | undefined);
    if (fromStart) return fromStart;
  }

  // From first step's startPosition or endPosition
  const first = sequence.steps?.[0];
  if (first) {
    const fromStepStart = extractGroup(first.startPosition as string | undefined);
    if (fromStepStart) return fromStepStart;
    const fromStepEnd = extractGroup(first.endPosition as string | undefined);
    if (fromStepEnd) return fromStepEnd;
  }

  // Derive from first step's motion start locations.
  // The start locations of step 1's motions = the end locations of the start position.
  // From two hand locations we can determine the position group:
  //   Alpha: hands opposite (S-N, E-W, NE-SW, etc.)
  //   Beta:  hands same location (S-S, N-N, etc.)
  //   Gamma: hands at right angles (S-E, S-W, N-E, N-W, etc.)
  const step1 = sequence.steps?.[0];
  const blueLoc = step1?.motions?.blue?.startLocation;
  const redLoc = step1?.motions?.red?.startLocation;
  if (blueLoc && redLoc) {
    return deriveGroupFromLocations(blueLoc, redLoc);
  }

  return null;
}

/** Determine position group from two hand compass locations */
function deriveGroupFromLocations(blue: string, red: string): string {
  if (blue === red) return "beta";

  // Opposite pairs → alpha
  const OPPOSITES: Record<string, string> = {
    n: "s", s: "n", e: "w", w: "e",
    ne: "sw", sw: "ne", nw: "se", se: "nw",
  };
  if (OPPOSITES[blue] === red) return "alpha";

  // Everything else is gamma (hands at non-opposite, non-same positions)
  return "gamma";
}

export function deriveCardBackData(
  sequence: SequenceData,
  converter: ISequenceToEntryConverter | null,
  explainer: ILOOPExplainer | null = null
): CardBackData {
  const levelNum = sequence.level ?? 1;
  const badge = LEVEL_BADGES[levelNum] ?? LEVEL_BADGES[1]!;
  const anatomy = deriveAnatomy(sequence);
  const reason = deriveLevelReason(levelNum, anatomy);

  // LOOP components: parse from stored loopType (same as front card)
  // so the icons always match between front and back
  const loopComponents = sequence.loopType
    ? loopTypeResolver.parseComponents(sequence.loopType)
    : new Set<LOOPComponent>();

  // Generate rich LOOP explanation when the explainer is available
  let loopExplanation: LOOPExplanation | null = null;
  if (loopComponents.size > 0 && explainer) {
    loopExplanation = explainer.explain(sequence, loopComponents);
  }

  const cycle = sequence.orientationCycleCount;

  return {
    word: sequence.word ?? sequence.name ?? "",
    stepCount: sequence.sequenceLength ?? sequence.steps?.length ?? 0,
    level: { ...badge, reason },
    anatomy,
    hasLoop: loopComponents.size > 0,
    loopComponents,
    loopLabel: sequence.loopType
      ? LOOP_TYPE_LABELS[sequence.loopType] ?? null
      : null,
    loopExplanation,
    sliceName: cycle === 4 ? "Quartered" : cycle === 2 ? "Halved" : null,
    sliceDetail:
      cycle === 4
        ? "4 reps, 90° each"
        : cycle === 2
          ? "2 reps, 180° each"
          : null,
    isRotated: sequence.loopType
      ? ROTATED_LOOP_TYPES.has(sequence.loopType)
      : false,
    startPositionGroup: deriveStartPositionGroup(sequence),
  };
}
