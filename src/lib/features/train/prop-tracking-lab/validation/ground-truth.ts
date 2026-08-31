import { MotionType, RotationDirection, Orientation } from '../domain/tka-enums';
import type { GridLocation } from '../domain/models';

/**
 * Ground-truth labels for validating the real-flow notation pipeline.
 *
 * The idea: Austen performs a known sequence on camera ("I performed X-Y-Z"),
 * writes down what he did in whichever JSON shape is cheapest to produce, and
 * the scorecard diffs the detected notation against it. Labels are partial by
 * design — any field left out is simply not scored, so "I only know the hand
 * locations" is a perfectly good ground truth.
 */

/** What the performer says one staff did over one beat. Every field optional. */
export interface GroundTruthMotion {
  motionType?: MotionType;
  startLocation?: GridLocation;
  endLocation?: GridLocation;
  /** Turn count, or 'fl' for a float (which has no turn count). */
  turns?: number | 'fl';
  rotationDirection?: RotationDirection;
  startOrientation?: Orientation;
  endOrientation?: Orientation;
}

/** One labeled beat. Either hand may be omitted entirely. */
export interface GroundTruthBeat {
  letter?: string;
  left?: GroundTruthMotion;
  right?: GroundTruthMotion;
}

export interface GroundTruthSequence {
  word?: string;
  beats: GroundTruthBeat[];
}


/** Case-insensitive lookup: lowercased spelling -> canonical enum value. */
function buildLookup(values: readonly string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const v of values) map.set(v.toLowerCase(), v);
  return map;
}

const MOTION_TYPE_LOOKUP = buildLookup(Object.values(MotionType));

const ROTATION_LOOKUP = buildLookup(Object.values(RotationDirection));
// Spelled-out aliases, because hand-written labels say "clockwise" as often as "cw".
ROTATION_LOOKUP.set('clockwise', RotationDirection.CLOCKWISE);
ROTATION_LOOKUP.set('counterclockwise', RotationDirection.COUNTER_CLOCKWISE);
ROTATION_LOOKUP.set('counter-clockwise', RotationDirection.COUNTER_CLOCKWISE);

const ORIENTATION_LOOKUP = buildLookup(Object.values(Orientation));

const GRID_LOCATIONS: readonly GridLocation[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
const LOCATION_LOOKUP = buildLookup(GRID_LOCATIONS);
// Full compass names map onto the short forms.
LOCATION_LOOKUP.set('north', 'n');
LOCATION_LOOKUP.set('northeast', 'ne');
LOCATION_LOOKUP.set('east', 'e');
LOCATION_LOOKUP.set('southeast', 'se');
LOCATION_LOOKUP.set('south', 's');
LOCATION_LOOKUP.set('southwest', 'sw');
LOCATION_LOOKUP.set('west', 'w');
LOCATION_LOOKUP.set('northwest', 'nw');


/** Throw a validation error that names exactly where the bad value lives. */
function invalid(
  beat: number,
  hand: 'blue' | 'red' | null,
  field: string,
  value: unknown,
  allowed?: readonly string[],
): never {
  const where = hand === null ? `beat ${beat}` : `beat ${beat}, ${hand} hand`;
  const hint = allowed ? ` (expected one of: ${allowed.join(', ')})` : '';
  throw new Error(`Ground truth ${where}: invalid ${field} ${JSON.stringify(value)}${hint}`);
}

// --- Field normalizers ------------------------------------------------------

function lookupEnum(
  raw: unknown,
  lookup: Map<string, string>,
  beat: number,
  hand: 'blue' | 'red',
  field: string,
): string {
  if (typeof raw !== 'string') {
    invalid(beat, hand, field, raw, [...new Set(lookup.values())]);
  }
  const hit = lookup.get(raw.trim().toLowerCase());
  if (hit === undefined) {
    invalid(beat, hand, field, raw, [...new Set(lookup.values())]);
  }
  return hit;
}

/** Turns: a number, a numeric string, or 'fl' (any casing) for a float. */
function normalizeTurns(raw: unknown, beat: number, hand: 'blue' | 'red'): number | 'fl' {
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) invalid(beat, hand, 'turns', raw);
    return raw;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.toLowerCase() === 'fl') return 'fl';
    const n = Number(trimmed);
    if (trimmed !== '' && Number.isFinite(n)) return n;
  }
  invalid(beat, hand, 'turns', raw, ['a number', 'a numeric string', "'fl'"]);
}

/** Normalize one hand's motion, keeping only the fields we know how to score. */
function normalizeMotion(
  raw: unknown,
  beat: number,
  hand: 'blue' | 'red',
): GroundTruthMotion | undefined {
  if (raw === null || raw === undefined) return undefined;
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    invalid(beat, hand, 'motion', raw);
  }
  const m = raw as Record<string, unknown>;
  const out: GroundTruthMotion = {};

  // Unknown extra fields (isVisible, propType, arrowLocation, gridMode,
  // placement data, ...) are deliberately ignored — pasted app sequence data
  // carries plenty of render-only baggage we don't score.
  if (m.motionType != null) {
    out.motionType = lookupEnum(m.motionType, MOTION_TYPE_LOOKUP, beat, hand, 'motionType') as MotionType;
  }
  if (m.startLocation != null) {
    out.startLocation = lookupEnum(m.startLocation, LOCATION_LOOKUP, beat, hand, 'startLocation') as GridLocation;
  }
  if (m.endLocation != null) {
    out.endLocation = lookupEnum(m.endLocation, LOCATION_LOOKUP, beat, hand, 'endLocation') as GridLocation;
  }
  if (m.turns != null) {
    out.turns = normalizeTurns(m.turns, beat, hand);
  }
  if (m.rotationDirection != null) {
    out.rotationDirection = lookupEnum(
      m.rotationDirection, ROTATION_LOOKUP, beat, hand, 'rotationDirection',
    ) as RotationDirection;
  }
  if (m.startOrientation != null) {
    out.startOrientation = lookupEnum(
      m.startOrientation, ORIENTATION_LOOKUP, beat, hand, 'startOrientation',
    ) as Orientation;
  }
  if (m.endOrientation != null) {
    out.endOrientation = lookupEnum(
      m.endOrientation, ORIENTATION_LOOKUP, beat, hand, 'endOrientation',
    ) as Orientation;
  }
  return out;
}

function normalizeBeat(raw: unknown, index: number): GroundTruthBeat {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`Ground truth beat ${index}: expected an object, got ${JSON.stringify(raw)}`);
  }
  const b = raw as Record<string, unknown>;
  const out: GroundTruthBeat = {};

  if (b.letter != null) {
    if (typeof b.letter !== 'string') invalid(index, null, 'letter', b.letter);
    out.letter = b.letter;
  }
  const left = normalizeMotion(b.left, index, 'blue');
  if (left) out.left = left;
  const right = normalizeMotion(b.right, index, 'red');
  if (right) out.right = right;
  return out;
}

// --- Shape detection ---------------------------------------------------------

/**
 * Pull { word, rawBeats } out of any of the three accepted shapes:
 * 1. Harness-native: { word?, beats: [{ letter?, blue, red }] }
 * 2. App sequence data: { word?, steps: [{ letter?, motions: { blue, red } }] }
 *    (what get_sequence_data / saved app sequences produce)
 * 3. Bare array of beats: [{ blue, red }, ...]
 */
function extractShape(data: unknown): { word?: string; rawBeats: unknown[] } {
  if (Array.isArray(data)) return { rawBeats: data };

  if (data !== null && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    const word = typeof obj.word === 'string' ? obj.word : undefined;

    if (Array.isArray(obj.beats)) return { word, rawBeats: obj.beats };

    if (Array.isArray(obj.steps)) {
      const rawBeats = obj.steps.map((step) => {
        if (step === null || typeof step !== 'object') return step; // beat normalizer reports it
        const s = step as Record<string, unknown>;
        const motions = (s.motions ?? {}) as Record<string, unknown>;
        return { letter: s.letter, left: motions.left, right: motions.right };
      });
      return { word, rawBeats };
    }
  }

  throw new Error(
    'Unrecognized ground truth shape — expected { beats: [...] }, an app sequence { steps: [...] }, or a bare array of beats.',
  );
}

/**
 * Parse a ground-truth JSON string into the normalized harness shape.
 *
 * Value spellings are forgiving: enum-ish strings are case-insensitive
 * ("PRO" -> "pro", "CW" -> "cw"), compass locations accept full names
 * ("NORTH" -> "n", "southwest" -> "sw"), and turns may be a number, a numeric
 * string, or "fl". Anything genuinely unrecognizable throws an Error naming
 * the beat index, hand, field, and the offending value.
 */
export function parseGroundTruth(json: string): GroundTruthSequence {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch (e) {
    throw new Error(`Ground truth is not valid JSON: ${(e as Error).message}`);
  }

  const { word, rawBeats } = extractShape(data);
  if (rawBeats.length === 0) {
    throw new Error('Ground truth has zero beats — nothing to score against.');
  }

  const beats = rawBeats.map(normalizeBeat);
  return word === undefined ? { beats } : { word, beats };
}
