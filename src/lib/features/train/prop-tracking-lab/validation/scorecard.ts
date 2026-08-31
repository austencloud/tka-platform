import type { StaffMotionNotation } from '../domain/notation-3d';
import type { GridLocation } from '../domain/models';
import type { Orientation, RotationDirection } from '../domain/tka-enums';
import type { BeatNotation } from '../services/notation-pipeline';
import type { GroundTruthBeat, GroundTruthMotion, GroundTruthSequence } from './ground-truth';

/**
 * Scorecard: a structured, letter-by-letter diff of detected notation against
 * a ground-truth label. The point is diagnosis, not pass/fail — when the
 * pipeline misreads a beat we want to see WHICH field it missed (locations
 * fine but turns off by 0.5? orientation flipped? whole beat never detected?)
 * rather than a single red X.
 */

export type FieldName =
  | 'startLocation'
  | 'endLocation'
  | 'motionType'
  | 'turns'
  | 'rotationDirection'
  | 'startOrientation'
  | 'endOrientation';

const FIELD_NAMES: readonly FieldName[] = [
  'startLocation',
  'endLocation',
  'motionType',
  'turns',
  'rotationDirection',
  'startOrientation',
  'endOrientation',
];

export interface FieldScore {
  field: FieldName;
  expected: string | number;
  detected: string | number;
  match: boolean;
}

export interface HandScore {
  fields: FieldScore[];
  matched: number;
  scored: number;
}

export interface BeatScore {
  /** null = spurious detected beat the truth never mentions (insertion). */
  truthIndex: number | null;
  /** null = ground-truth beat the pipeline never detected (deletion). */
  detectedIndex: number | null;
  letter?: string;
  left: HandScore | null;
  right: HandScore | null;
  /** matched/scored across both hands; 0 when unaligned or nothing scored. */
  score: number;
  /** min(blue, red) confidence of the detected beat; null when deletion. */
  confidence: number | null;
}

export interface ScorecardReport {
  beats: BeatScore[];
  overall: { matched: number; scored: number; accuracy: number };
  perField: Record<FieldName, { matched: number; scored: number }>;
  detectedBeatCount: number;
  truthBeatCount: number;
  /** How the same detection scores if we assume the camera mirrored left/right. */
  mirrored: { accuracy: number; likelyMirrored: boolean };
  notes: string[];
}


/** Snap a turn count to the quarter-turn lattice so 1.499 vs 1.5 doesn't fail. */
function roundQuarter(x: number): number {
  return Math.round(x * 4) / 4;
}

function scoreField(field: FieldName, detected: StaffMotionNotation, expected: string | number): FieldScore {
  if (field === 'turns') {
    // 'fl' means "this was a float" — the detected side encodes that in
    // motionType (floats always carry turns = 0), so match on that instead.
    if (expected === 'fl') {
      const isFloat = detected.motionType === 'float';
      return { field, expected: 'fl', detected: isFloat ? 'fl' : detected.turns, match: isFloat };
    }
    const want = roundQuarter(expected as number);
    const got = roundQuarter(detected.turns);
    return { field, expected: want, detected: got, match: want === got };
  }
  const got = detected[field];
  return { field, expected, detected: got, match: got === expected };
}

/** Score one hand: only the fields the ground truth actually supplied count. */
function scoreHand(detected: StaffMotionNotation, truth: GroundTruthMotion): HandScore {
  const fields: FieldScore[] = [];
  for (const field of FIELD_NAMES) {
    const expected = truth[field];
    if (expected === undefined) continue;
    fields.push(scoreField(field, detected, expected));
  }
  const matched = fields.filter((f) => f.match).length;
  return { fields, matched, scored: fields.length };
}

/** Pair similarity for alignment: fraction of supplied fields that match, both hands. */
function beatSimilarity(detected: BeatNotation, truth: GroundTruthBeat): number {
  let matched = 0;
  let scored = 0;
  if (truth.left) {
    const h = scoreHand(detected.left, truth.left);
    matched += h.matched;
    scored += h.scored;
  }
  if (truth.right) {
    const h = scoreHand(detected.right, truth.right);
    matched += h.matched;
    scored += h.scored;
  }
  return scored === 0 ? 0 : matched / scored;
}


/**
 * Beat segmentation is untuned, so detected beat counts routinely disagree
 * with the ground truth. Needleman-Wunsch global alignment finds the best
 * order-preserving pairing; unpaired beats surface as insertions/deletions
 * instead of shifting every downstream comparison off by one.
 */
const GAP_PENALTY = 0.25;

interface AlignedStep {
  detectedIndex: number | null;
  truthIndex: number | null;
}

function alignBeats(detected: BeatNotation[], truth: GroundTruthBeat[]): AlignedStep[] {
  const n = detected.length;
  const m = truth.length;

  // Precompute similarities once — the DP consults each pair up to three times.
  const sim: number[][] = [];
  for (let i = 0; i < n; i++) {
    sim.push(truth.map((t) => beatSimilarity(detected[i]!, t)));
  }

  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 1; i <= n; i++) dp[i]![0] = -GAP_PENALTY * i;
  for (let j = 1; j <= m; j++) dp[0]![j] = -GAP_PENALTY * j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i]![j] = Math.max(
        dp[i - 1]![j - 1]! + sim[i - 1]![j - 1]!,
        dp[i - 1]![j]! - GAP_PENALTY,
        dp[i]![j - 1]! - GAP_PENALTY,
      );
    }
  }

  // Traceback, preferring diagonal on ties so equal-count sequences pair 1:1.
  const steps: AlignedStep[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && dp[i]![j] === dp[i - 1]![j - 1]! + sim[i - 1]![j - 1]!) {
      steps.push({ detectedIndex: i - 1, truthIndex: j - 1 });
      i--;
      j--;
    } else if (i > 0 && dp[i]![j] === dp[i - 1]![j]! - GAP_PENALTY) {
      steps.push({ detectedIndex: i - 1, truthIndex: null }); // insertion
      i--;
    } else {
      steps.push({ detectedIndex: null, truthIndex: j - 1 }); // deletion
      j--;
    }
  }
  return steps.reverse();
}


function emptyPerField(): Record<FieldName, { matched: number; scored: number }> {
  return {
    startLocation: { matched: 0, scored: 0 },
    endLocation: { matched: 0, scored: 0 },
    motionType: { matched: 0, scored: 0 },
    turns: { matched: 0, scored: 0 },
    rotationDirection: { matched: 0, scored: 0 },
    startOrientation: { matched: 0, scored: 0 },
    endOrientation: { matched: 0, scored: 0 },
  };
}

function minConfidence(beat: BeatNotation): number {
  return Math.min(beat.left.confidence, beat.right.confidence);
}

interface CoreResult {
  beats: BeatScore[];
  overall: { matched: number; scored: number; accuracy: number };
  perField: Record<FieldName, { matched: number; scored: number }>;
}

function scoreCore(detected: BeatNotation[], truthBeats: GroundTruthBeat[]): CoreResult {
  const perField = emptyPerField();
  let totalMatched = 0;
  let totalScored = 0;

  const beats: BeatScore[] = alignBeats(detected, truthBeats).map((step) => {
    // Unaligned beats carry no field scores — they ARE the finding.
    if (step.detectedIndex === null) {
      const t = truthBeats[step.truthIndex!]!;
      const beatScore: BeatScore = {
        truthIndex: step.truthIndex,
        detectedIndex: null,
        left: null,
        right: null,
        score: 0,
        confidence: null,
      };
      if (t.letter !== undefined) beatScore.letter = t.letter;
      return beatScore;
    }
    const d = detected[step.detectedIndex]!;
    if (step.truthIndex === null) {
      return {
        truthIndex: null,
        detectedIndex: step.detectedIndex,
        left: null,
        right: null,
        score: 0,
        confidence: minConfidence(d),
      };
    }

    const t = truthBeats[step.truthIndex]!;
    const left = t.left ? scoreHand(d.left, t.left) : null;
    const right = t.right ? scoreHand(d.right, t.right) : null;
    const matched = (left?.matched ?? 0) + (right?.matched ?? 0);
    const scored = (left?.scored ?? 0) + (right?.scored ?? 0);
    totalMatched += matched;
    totalScored += scored;
    for (const hand of [left, right]) {
      if (!hand) continue;
      for (const f of hand.fields) {
        perField[f.field].scored++;
        if (f.match) perField[f.field].matched++;
      }
    }

    const beatScore: BeatScore = {
      truthIndex: step.truthIndex,
      detectedIndex: step.detectedIndex,
      left,
      right,
      score: scored === 0 ? 0 : matched / scored,
      confidence: minConfidence(d),
    };
    if (t.letter !== undefined) beatScore.letter = t.letter;
    return beatScore;
  });

  return {
    beats,
    overall: {
      matched: totalMatched,
      scored: totalScored,
      accuracy: totalScored === 0 ? 0 : totalMatched / totalScored,
    },
    perField,
  };
}


const MIRROR_LOCATION: Record<GridLocation, GridLocation> = {
  n: 'n',
  s: 's',
  e: 'w',
  w: 'e',
  ne: 'nw',
  nw: 'ne',
  se: 'sw',
  sw: 'se',
};

function mirrorOrientation(o: Orientation): Orientation {
  if (o === 'clock') return 'counter';
  if (o === 'counter') return 'clock';
  return o; // in/out are radial — mirror-invariant
}

function mirrorRotation(r: RotationDirection): RotationDirection {
  if (r === 'cw') return 'ccw';
  if (r === 'ccw') return 'cw';
  return r;
}

function mirrorStaff(m: StaffMotionNotation): StaffMotionNotation {
  return {
    ...m,
    startLocation: MIRROR_LOCATION[m.startLocation],
    endLocation: MIRROR_LOCATION[m.endLocation],
    rotationDirection: mirrorRotation(m.rotationDirection),
    startOrientation: mirrorOrientation(m.startOrientation),
    endOrientation: mirrorOrientation(m.endOrientation),
    // motionType stays put: mirroring flips BOTH the hand-arc sign and the
    // prop-rotation sign, so the with/against relationship (pro vs anti) is
    // preserved. handMotion and turns are magnitudes — also unchanged.
  };
}

/**
 * Flip a detected beat as a front-facing camera would: east/west swap,
 * clock/counter swap, cw/ccw swap. Everything mirror-invariant stays.
 */
export function mirrorBeatNotation(b: BeatNotation): BeatNotation {
  return { left: mirrorStaff(b.left), right: mirrorStaff(b.right) };
}


/**
 * Diff detected notation against a ground-truth label.
 *
 * Only fields the ground truth supplies are scored, unaligned beats show up as
 * insertions/deletions rather than cascading mismatches, and every run also
 * scores the left/right-mirrored detection — a front-facing camera that
 * mirrors the performer is the classic sign-convention trap, and it announces
 * itself as "mirrored scores way better".
 */
export function scoreNotation(detected: BeatNotation[], truth: GroundTruthSequence): ScorecardReport {
  const plain = scoreCore(detected, truth.beats);
  const mirroredRun = scoreCore(detected.map(mirrorBeatNotation), truth.beats);

  const accuracy = plain.overall.accuracy;
  const mirroredAccuracy = mirroredRun.overall.accuracy;
  const likelyMirrored = mirroredAccuracy - accuracy > 0.15 && mirroredAccuracy > 0.5;

  const notes: string[] = [];
  if (detected.length !== truth.beats.length) {
    notes.push(`detected ${detected.length} beats, ground truth ${truth.beats.length}`);
  }
  const lowConfidence = detected
    .map((b, i) => ({ index: i, confidence: minConfidence(b) }))
    .filter((b) => b.confidence < 0.5);
  if (lowConfidence.length > 0) {
    const list = lowConfidence.map((b) => `#${b.index} (${b.confidence.toFixed(2)})`).join(', ');
    notes.push(`low-confidence detected beats (< 0.5): ${list}`);
  }
  if (likelyMirrored) {
    notes.push(
      `Camera-mirror hypothesis: mirroring the detected notation left/right raises accuracy from ` +
        `${(accuracy * 100).toFixed(0)}% to ${(mirroredAccuracy * 100).toFixed(0)}%. A front-facing ` +
        `camera likely mirrored the performer — re-run ScreenToGrid/notation with mirroring applied.`,
    );
  }

  return {
    beats: plain.beats,
    overall: plain.overall,
    perField: plain.perField,
    detectedBeatCount: detected.length,
    truthBeatCount: truth.beats.length,
    mirrored: { accuracy: mirroredAccuracy, likelyMirrored },
    notes,
  };
}
