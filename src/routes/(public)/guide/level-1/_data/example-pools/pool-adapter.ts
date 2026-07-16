/**
 * Example-pool adapter - turns the curated pilot JSON (verbatim MCP
 * generate_sequence step data) into playable PictographData[] strips using the
 * SAME canonical primitives the hand-authored permutations content uses
 * (createMotionData, getGridPositionFromLocations, bakeReversals). One faithful
 * path, so a pooled example renders byte-for-byte like an authored one.
 *
 * Provenance: src/.../example-pools/README.md → the design spec
 * (docs/superpowers/specs/2026-07-16-guide-example-pools-design.md). The JSON is
 * the single source; do not hand-edit strips here.
 *
 * Nomenclature: a `step` is one pictograph in a sequence. Never "beat".
 */
import poolJson from "./permutations.pool.json";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import {
  MotionType,
  MotionColor,
  Orientation,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import {
  GridMode,
  GridLocation,
  GridPosition,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  getGridPositionFromLocations,
  getGridLocationsFromPosition,
} from "$lib/shared/pictograph/grid/services/grid-position-deriver";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import { Letter } from "$lib/shared/foundation/domain/models/letter";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
import type { PoolEntry } from "../guide-content-blocks";
import { bakeReversals } from "../guide-sequence-adapter";

export type { PoolEntry };

// ── Raw JSON shapes ────────────────────────────────────────────────────────
type RawHand = { type: string; dir: string; turns?: number; ori: string };
type RawStep = { step: number; letter: string; pos: string; blue: RawHand; red: RawHand };
type RawEntry = {
  word: string;
  loopType: string;
  period?: string;
  prose: string;
  steps: RawStep[];
};
type RawSlot = { defaultEntry: string; candidates: RawEntry[] };
type RawPool = { slots: Record<string, RawSlot> };

// PoolEntry is defined in guide-content-blocks.ts (the content-model hub) and
// re-exported above.

// ── Enum lookups (JSON string → canonical enum) ────────────────────────────
const MOTION_TYPE: Record<string, MotionType> = {
  pro: MotionType.PRO,
  anti: MotionType.ANTI,
  dash: MotionType.DASH,
  static: MotionType.STATIC,
};
const ROT_DIR: Record<string, RotationDirection> = {
  cw: RotationDirection.CLOCKWISE,
  ccw: RotationDirection.COUNTER_CLOCKWISE,
  noRotation: RotationDirection.NO_ROTATION,
};
const ORI: Record<string, Orientation> = { in: Orientation.IN, out: Orientation.OUT };

// The Letter const-union's VALUES ARE the display strings ("G", "Θ", "W-",
// "Ψ-", "Σ-", "β", …), so a membership check IS the lookup. Greek start letters
// (β/α/γ) are Letter values too (BETA/ALPHA/GAMMA), so one gate covers steps and
// start boxes alike.
const LETTER_VALUES = new Set<string>(Object.values(Letter));
const POSITION_VALUES = new Set<string>(Object.values(GridPosition));

function toLetter(s: string): Letter {
  if (!LETTER_VALUES.has(s)) throw new Error(`pool-adapter: unmapped letter "${s}"`);
  return s as Letter;
}
function toPosition(s: string): GridPosition {
  if (!POSITION_VALUES.has(s)) throw new Error(`pool-adapter: unknown position "${s}"`);
  return s as GridPosition;
}
function req<T>(v: T | undefined, msg: string): T {
  if (v === undefined) throw new Error(`pool-adapter: ${msg}`);
  return v;
}

/**
 * Init-time invariant. The canonical inverse (getGridLocationsFromPosition) is
 * what the adapter uses to turn a position NAME back into a (blue, red) location
 * pair - the deriver is the canon, so we reuse its inverse rather than
 * hand-author a table. This assertion enumerates EVERY GridLocation pair through
 * the canonical forward deriver and proves the property the pool relies on: the
 * inverse is unique per position (no two location pairs collapse onto one
 * position) and round-trips (canon inverse of a position forward-derives back to
 * it). Throws at module load if the canon ever drifts.
 */
function assertPositionInverseIsUnique(): void {
  const producedBy = new Map<GridPosition, string>();
  const locations = Object.values(GridLocation);
  for (const blue of locations) {
    for (const red of locations) {
      let pos: GridPosition;
      try {
        pos = getGridPositionFromLocations(blue as GridLocation, red as GridLocation);
      } catch {
        continue; // not a valid position pair - skip
      }
      const key = `${blue},${red}`;
      const prior = producedBy.get(pos);
      if (prior && prior !== key) {
        throw new Error(
          `pool-adapter: position ${pos} is not unique: produced by ${prior} and ${key}`
        );
      }
      producedBy.set(pos, key);
    }
  }
  for (const [pos, key] of producedBy) {
    const [b, r] = getGridLocationsFromPosition(pos);
    if (getGridPositionFromLocations(b, r) !== pos) {
      throw new Error(`pool-adapter: inverse round-trip failed for ${pos}`);
    }
    if (`${b},${r}` !== key) {
      throw new Error(`pool-adapter: inverse mismatch for ${pos}: canon ${b},${r} vs forward ${key}`);
    }
  }
}
assertPositionInverseIsUnique();

function locationsOf(posName: string): { blue: GridLocation; red: GridLocation } {
  const [blue, red] = getGridLocationsFromPosition(toPosition(posName));
  return { blue, red };
}

/** "beta7→beta1" → { start: "beta7", end: "beta1" }. */
function parsePair(raw: string, label: string): { start: string; end: string } {
  const parts = raw.split("→").map((s) => s.trim());
  if (parts.length !== 2) throw new Error(`pool-adapter: malformed ${label} "${raw}"`);
  return { start: parts[0]!, end: parts[1]! };
}

/** One hand's motion, values taken straight from the JSON (they are exact - no
 *  HP_CW inference). Locations come from the inverted start/end positions. */
function handMotion(
  color: MotionColor,
  h: RawHand,
  from: GridLocation,
  to: GridLocation
): MotionData {
  const { start: so, end: eo } = parsePair(h.ori, "orientation");
  return createMotionData({
    motionType: req(MOTION_TYPE[h.type], `unknown motion type "${h.type}"`),
    rotationDirection: req(ROT_DIR[h.dir], `unknown rotation direction "${h.dir}"`),
    startLocation: from,
    endLocation: to,
    startOrientation: req(ORI[so], `unknown orientation "${so}"`),
    endOrientation: req(ORI[eo], `unknown orientation "${eo}"`),
    turns: h.turns ?? 0,
    color,
    propType: PropType.STAFF,
    gridMode: GridMode.DIAMOND,
  });
}

/**
 * A curated entry → its PictographData strip: start box from step 0, then one
 * StepData per step 1..n (locations from the inverted positions, motion fields
 * from the JSON), then bakeReversals over the steps - exactly the shape
 * permutations.content.ts builds by hand.
 */
export function entryToStrip(entry: RawEntry): PictographData[] {
  const steps = entry.steps;
  if (!steps.length) throw new Error(`pool-adapter: ${entry.word} has no steps`);

  const s0 = steps.find((s) => s.step === 0) ?? steps[0]!;
  const startLoc = locationsOf(parsePair(s0.pos, "position").start);
  const startBox = {
    id: `pool-${entry.word}-0`,
    letter: toLetter(s0.letter),
    gridMode: GridMode.DIAMOND,
    stepNumber: 0,
    startPosition: getGridPositionFromLocations(startLoc.blue, startLoc.red),
    endPosition: getGridPositionFromLocations(startLoc.blue, startLoc.red),
    motions: {
      blue: handMotion(MotionColor.BLUE, s0.blue, startLoc.blue, startLoc.blue),
      red: handMotion(MotionColor.RED, s0.red, startLoc.red, startLoc.red),
    },
  } as unknown as StepData;

  const stepBoxes = steps
    .filter((s) => s.step > 0)
    .map((s) => {
      const { start, end } = parsePair(s.pos, "position");
      const from = locationsOf(start);
      const to = locationsOf(end);
      return {
        id: `pool-${entry.word}-${s.step}`,
        letter: toLetter(s.letter),
        gridMode: GridMode.DIAMOND,
        stepNumber: s.step,
        startPosition: getGridPositionFromLocations(from.blue, from.red),
        endPosition: getGridPositionFromLocations(to.blue, to.red),
        motions: {
          blue: handMotion(MotionColor.BLUE, s.blue, from.blue, to.blue),
          red: handMotion(MotionColor.RED, s.red, from.red, to.red),
        },
      } as unknown as StepData;
    });

  // Reversal dots derived from the motions themselves (never hand-claimed) -
  // same channel and policy as the hand-authored strips.
  const baked = bakeReversals(stepBoxes);
  return [startBox, ...baked] as unknown as PictographData[];
}

/** Semantic label for the slot/entry. Rotated carries its rotation slice
 *  (halved = 180°, quartered = 90°); "turns" is never used for loop rotation. */
export function loopLabel(entry: RawEntry): string {
  if (entry.loopType === "rotated") {
    const deg = entry.period === "halved" ? "180°" : entry.period === "quartered" ? "90°" : "";
    return deg ? `Rotated ${deg}` : "Rotated";
  }
  if (entry.loopType === "mirrored") return "Mirrored";
  if (entry.loopType === "swapped") return "Swapped";
  return entry.loopType;
}

/** Entries that failed to adapt (unmapped letter / non-inverting position) are
 *  EXCLUDED and recorded here, so one bad candidate never breaks the page. */
export const flaggedEntries: { slot: string; word: string; reason: string }[] = [];

function buildSlot(slotKey: string, slot: RawSlot | undefined): PoolEntry[] {
  const out: PoolEntry[] = [];
  for (const entry of slot?.candidates ?? []) {
    try {
      out.push({
        word: entry.word,
        loopLabel: loopLabel(entry),
        proseHtml: entry.prose,
        items: entryToStrip(entry),
      });
    } catch (err) {
      flaggedEntries.push({
        slot: slotKey,
        word: entry.word,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return out;
}

const slots = (poolJson as RawPool).slots;

/** Raw candidate slates, exposed for tests (and re-adaptation). */
export const rawSlots = slots;

/** Adapter candidates (entries 1..N) per slot. The content file prepends
 *  entry 0 (the original print example). */
export const mirroredPool: PoolEntry[] = buildSlot("mirrored", slots.mirrored);
export const rotatedPool: PoolEntry[] = buildSlot("rotated", slots.rotated);
export const swappedPool: PoolEntry[] = buildSlot("swapped", slots.swapped);
