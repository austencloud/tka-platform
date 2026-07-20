/**
 * Trace Evaluator — grades a two-hand fingertip trace against a canonical route.
 *
 * Deliberately pure: no DOM, no rAF, no timers, no globals, no runes. You feed
 * it normalized samples and lifecycle signals, it hands back state and metrics.
 * The Svelte layer wraps this; keeping the judgement here means the whole
 * scoring model is testable in plain node, and it means a pointer bug can never
 * be mistaken for a scoring bug.
 *
 * What it actually enforces, and why each piece exists:
 *
 * - ORDER AND DIRECTION MATTER. A player who draws the right shape backwards
 *   has not done the thing. Checkpoints are consumed in sequence; a later one
 *   reached before an earlier one is recorded as a skip, never as credit.
 * - Checkpoint detection sweeps the LINE BETWEEN consecutive samples, not the
 *   samples themselves. A fast finger on a 30 Hz device can jump clean over a
 *   small target between two events; a point-in-circle test would tell that
 *   player they missed something they actually went straight through.
 * - An explicit lift (pointerup) breaks strict continuity. An interruption
 *   (pointercancel, a notification, the app losing visibility) does not — that
 *   is the system's fault, not the player's, and it is modelled as a separate
 *   signal precisely so it can never be scored as a mistake.
 * - Beats gate on BOTH hands. One hand may arrive early and wait; waiting is
 *   not a failure. A hand that is holding still must actually stay put, and
 *   leaving its hold zone blocks the beat for both hands.
 * - Every tolerance is stage-relative (0..1), so the same gesture scores the
 *   same on a phone and on a 4K monitor.
 */

import type {
  CorridorExcursion,
  NormalizedPoint,
  TraceBeat,
  TraceDivergence,
  TraceHand,
  TraceMetrics,
  TraceSample,
  TraceSegment,
} from "../domain/trace-types";
import {
  TRACE_CORRIDOR_HALF_WIDTH,
  TRACE_CHECKPOINT_RADIUS,
  TRACE_HOLD_ZONE_RADIUS,
  TRACE_PATH_SAMPLE_COUNT,
  TRACE_PROGRESS_REGRESSION_ALLOWANCE,
  TRACE_SYNCHRONY_WINDOW_MS,
} from "../domain/trace-config";
import {
  arcLengthResample,
  sampleSegmentPath,
  truncatePolyline,
} from "./trace-path-sampler";

// ---------------------------------------------------------------------------
// Geometry contract
// ---------------------------------------------------------------------------

/**
 * The slice of a round the evaluator actually needs.
 *
 * A full `TraceRound` satisfies this structurally, so callers pass one
 * directly. Naming the narrow shape keeps the grader honest: it should not
 * care what a round is called, what grid it renders on, or how it is themed.
 */
export interface TraceRoundGeometry {
  readonly beats: readonly TraceBeat[];
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/**
 * Every radius here is a fraction of the stage's shorter side. `trace-config.ts`
 * owns the app-facing named constants; this object is the evaluator's own
 * fallback so the grader stays runnable (and testable) standalone.
 */
export interface TraceEvaluatorConfig {
  /** How close to a segment's start point a finger must land before anything counts. */
  readonly startZoneRadius: number;
  /** How close to the segment's end point counts as arriving. */
  readonly endZoneRadius: number;
  /** Radius of each intermediate checkpoint along the route. */
  readonly checkpointRadius: number;
  /** How far a holding hand may drift before the hold is broken. */
  readonly holdRadius: number;
  /** Half-width of the route corridor; outside this is an excursion. */
  readonly corridorRadius: number;
  /** Checkpoints per moving segment, the last of which sits on the end point. */
  readonly checkpointsPerSegment: number;
  /** Backward progress allowed before it counts as a regression (fingertip jitter). */
  readonly regressionAllowance: number;
  /** How hard regressions pull continuity down (0 = ignore them entirely). */
  readonly regressionPenalty: number;
  /**
   * How far along the route a finger may touch down, still inside the
   * corridor, before we call it starting in the wrong place. Catches the
   * player who traces the right curve from the wrong end.
   */
  readonly startBypassProgress: number;
  /** Fréchet distance at which accuracy reaches zero. */
  readonly accuracyFalloff: number;
  /** Points each trace is resampled to before the Fréchet comparison. */
  readonly frechetSamples: number;
  /** Arrival gap between hands at which synchrony reaches zero. */
  readonly synchronyToleranceMs: number;
  /** Sampling resolution of the canonical route. */
  readonly pathSegments: number;
}

export const DEFAULT_TRACE_EVALUATOR_CONFIG: TraceEvaluatorConfig = {
  // Landing on a grid point and holding still on one are the same ask, so they
  // share the same tolerance rather than drifting apart as two numbers.
  startZoneRadius: TRACE_HOLD_ZONE_RADIUS,
  endZoneRadius: TRACE_HOLD_ZONE_RADIUS,
  holdRadius: TRACE_HOLD_ZONE_RADIUS,
  corridorRadius: TRACE_CORRIDOR_HALF_WIDTH,
  // A CEILING, not the value used. See `effectiveCheckpointRadius` — a
  // checkpoint that is bigger than the route's own bulge cannot tell the route
  // apart from a straight shortcut across it, so each segment shrinks this to
  // whatever its geometry can actually discriminate.
  checkpointRadius: TRACE_CHECKPOINT_RADIUS,
  regressionAllowance: TRACE_PROGRESS_REGRESSION_ALLOWANCE,
  synchronyToleranceMs: TRACE_SYNCHRONY_WINDOW_MS,
  frechetSamples: TRACE_PATH_SAMPLE_COUNT,
  pathSegments: TRACE_PATH_SAMPLE_COUNT - 1,

  // The rest have no home in trace-config yet because they are grading policy
  // rather than touch tolerances. Move them there if they ever need tuning
  // alongside the others.
  //
  // Four waypoints per segment: enough that a quarter-arc cannot be faked by
  // its chord, few enough that their circles never overlap.
  checkpointsPerSegment: 4,
  regressionPenalty: 0.5,
  startBypassProgress: 0.5,
  // A trace that wanders a full corridor-width off the spine has lost most of
  // its accuracy; a little past that, all of it.
  accuracyFalloff: TRACE_CORRIDOR_HALF_WIDTH * 1.5,
};

// ---------------------------------------------------------------------------
// Public surface
// ---------------------------------------------------------------------------

export interface TraceEvaluatorState {
  /** Beat currently being evaluated; equals `totalBeats` once the round is done. */
  readonly beatIndex: number;
  readonly completedBeats: number;
  readonly totalBeats: number;
  readonly hands: readonly TraceHand[];
  /** Per hand: has this hand entered the current beat's start zone yet? */
  readonly armed: Partial<Record<TraceHand, boolean>>;
  /** Per hand: has this hand met the current beat (and is now waiting)? */
  readonly satisfied: Partial<Record<TraceHand, boolean>>;
  readonly checkpointsHit: number;
  readonly checkpointsTotal: number;
  readonly divergences: readonly TraceDivergence[];
  readonly excursions: readonly CorridorExcursion[];
}

export interface TraceEvaluator {
  ingest(hand: TraceHand, samples: readonly TraceSample[]): void;
  /** The player deliberately lifted the finger. Breaks strict continuity. */
  notifyLift(hand: TraceHand): void;
  /** The system took the pointer away (cancel/visibility loss). Never a failure. */
  notifyInterruption(hand: TraceHand): void;
  readonly state: TraceEvaluatorState;
  finish(): TraceMetrics;
}

// ---------------------------------------------------------------------------
// Small pure geometry helpers
// ---------------------------------------------------------------------------

function distance(a: NormalizedPoint, b: NormalizedPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Does the swept line a→b come within `radius` of `centre`?
 *
 * This is the whole reason a fast finger is graded fairly: we test the path the
 * finger travelled between two events, not the two isolated dots the hardware
 * happened to report.
 */
export function segmentIntersectsCircle(
  a: NormalizedPoint,
  b: NormalizedPoint,
  centre: NormalizedPoint,
  radius: number
): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  let t = 0;
  if (lengthSq > 0) {
    t = ((centre.x - a.x) * dx + (centre.y - a.y) * dy) / lengthSq;
    t = Math.max(0, Math.min(1, t));
  }
  const px = a.x + t * dx;
  const py = a.y + t * dy;
  return Math.hypot(px - centre.x, py - centre.y) <= radius;
}

interface Projection {
  /** Perpendicular distance from the point to the polyline. */
  readonly distance: number;
  /** How far along the polyline (0..1 by arc length) the closest point sits. */
  readonly progress: number;
}

export function projectOntoPolyline(
  point: NormalizedPoint,
  polyline: readonly NormalizedPoint[],
  cumulative: readonly number[],
  totalLength: number
): Projection {
  let best = Number.POSITIVE_INFINITY;
  let bestProgress = 0;
  for (let i = 0; i < polyline.length - 1; i++) {
    const a = polyline[i]!;
    const b = polyline[i + 1]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSq = dx * dx + dy * dy;
    let t = 0;
    if (lengthSq > 0) {
      t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq;
      t = Math.max(0, Math.min(1, t));
    }
    const px = a.x + t * dx;
    const py = a.y + t * dy;
    const d = Math.hypot(px - point.x, py - point.y);
    if (d < best) {
      best = d;
      const along = cumulative[i]! + t * Math.sqrt(lengthSq);
      bestProgress = totalLength === 0 ? 0 : along / totalLength;
    }
  }
  return { distance: best, progress: bestProgress };
}

/**
 * Discrete Fréchet distance (Eiter & Mannila) between two ordered point
 * sequences — the classic "shortest leash" measure.
 *
 * Order-sensitive by construction, which is exactly what this game needs:
 * unlike a Hausdorff distance, drawing the right shape backwards does not
 * produce a small number here.
 */
export function discreteFrechet(
  p: readonly NormalizedPoint[],
  q: readonly NormalizedPoint[]
): number {
  if (p.length === 0 || q.length === 0) return Number.POSITIVE_INFINITY;

  let previous = new Array<number>(q.length);
  let current = new Array<number>(q.length);

  for (let j = 0; j < q.length; j++) {
    const d = distance(p[0]!, q[j]!);
    previous[j] = j === 0 ? d : Math.max(previous[j - 1]!, d);
  }

  for (let i = 1; i < p.length; i++) {
    for (let j = 0; j < q.length; j++) {
      const d = distance(p[i]!, q[j]!);
      if (j === 0) {
        current[j] = Math.max(previous[0]!, d);
      } else {
        const best = Math.min(previous[j]!, previous[j - 1]!, current[j - 1]!);
        current[j] = Math.max(best, d);
      }
    }
    const swap = previous;
    previous = current;
    current = swap;
  }

  return previous[q.length - 1]!;
}

/** A stage with a known aspect, for turning raw distances into 0..1 fractions. */
export interface StageDimensions {
  readonly width: number;
  readonly height: number;
}

/** The stage this game grades on is the normalized unit square. */
export const UNIT_STAGE: StageDimensions = { width: 1, height: 1 };

/**
 * Normalize a distance by the stage's SHORTER dimension.
 *
 * The evaluator already works in a 0..1 square, so today this is the identity —
 * that is stated as a named function rather than left implicit so that a future
 * non-square stage gets handled by changing one argument instead of growing a
 * second, divergent normalization somewhere else.
 */
export function normalizeStageDistance(
  raw: number,
  stage: StageDimensions = UNIT_STAGE
): number {
  const shorter = Math.min(stage.width, stage.height);
  return shorter <= 0 ? 0 : raw / shorter;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

type SlotKind = "move" | "hold" | "absent";

interface Slot {
  readonly hand: TraceHand;
  readonly beatIndex: number;
  readonly kind: SlotKind;
  readonly path: NormalizedPoint[];
  readonly cumulative: number[];
  readonly totalLength: number;
  readonly checkpoints: NormalizedPoint[];
  /** How many checkpoints this slot contributes to coverage. */
  readonly checkpointsTotal: number;
  /** Geometry-derived, never larger than the configured ceiling. */
  readonly checkpointRadius: number;
  nextCheckpoint: number;
  hitCount: number;
  armed: boolean;
  satisfiedAtMs: number | null;
  maxProgress: number;
  actual: NormalizedPoint[];
  lastArmedPoint: NormalizedPoint | null;
  lifted: boolean;
  holdBroken: boolean;
  skipRecorded: boolean;
  wrongOrderRecorded: boolean;
  excursionMax: number;
  excursionSamples: number;
  regressions: number;
  comparisons: number;
  seen: number;
}

interface HandRuntime {
  queue: TraceSample[];
  lastPoint: NormalizedPoint | null;
  lastKept: NormalizedPoint | null;
  interruptions: number;
  firstT: number | null;
  lastT: number | null;
}

/**
 * How far a route bulges away from the straight line between its own endpoints.
 *
 * This is the amount of curve a checkpoint has to be able to see. A dash is
 * straight, so it returns 0 and the discrimination cap below does not apply.
 */
function chordDeviation(path: readonly NormalizedPoint[]): number {
  if (path.length < 3) return 0;
  const start = path[0]!;
  const end = path[path.length - 1]!;
  let worst = 0;
  for (const point of path) {
    worst = Math.max(worst, projectOntoPolyline(point, [start, end], [0], Math.hypot(end.x - start.x, end.y - start.y)).distance);
  }
  return worst;
}

/**
 * The checkpoint radius this particular segment can actually use.
 *
 * Two caps, both geometric:
 *  - half the spacing between checkpoints, so neighbouring targets never
 *    overlap and one sweep cannot claim two of them by accident;
 *  - a fraction of the route's own bulge, so a checkpoint is never so fat that
 *    a straight drag between the endpoints passes through it. Without this,
 *    a generous global tolerance quietly turns every arc into a chord and the
 *    game stops being a trace at all.
 */
function effectiveCheckpointRadius(
  ceiling: number,
  path: readonly NormalizedPoint[],
  totalLength: number,
  checkpointCount: number
): number {
  let radius = ceiling;
  if (checkpointCount > 0 && totalLength > 0) {
    radius = Math.min(radius, (totalLength / checkpointCount) * 0.5);
  }
  const bulge = chordDeviation(path);
  if (bulge > 1e-6) radius = Math.min(radius, bulge * 0.6);
  return radius;
}

function buildSlot(
  hand: TraceHand,
  beatIndex: number,
  segment: TraceSegment | undefined,
  config: TraceEvaluatorConfig
): Slot {
  const base = {
    hand,
    beatIndex,
    nextCheckpoint: 0,
    hitCount: 0,
    armed: false,
    satisfiedAtMs: null,
    maxProgress: 0,
    actual: [] as NormalizedPoint[],
    lastArmedPoint: null,
    lifted: false,
    holdBroken: false,
    skipRecorded: false,
    wrongOrderRecorded: false,
    excursionMax: 0,
    excursionSamples: 0,
    regressions: 0,
    comparisons: 0,
    seen: 0,
  };

  if (!segment) {
    return {
      ...base,
      kind: "absent",
      path: [],
      cumulative: [],
      totalLength: 0,
      checkpoints: [],
      checkpointsTotal: 0,
      checkpointRadius: config.checkpointRadius,
    };
  }

  if (segment.kind === "hold") {
    const point = sampleSegmentPath(
      segment.location,
      segment.location,
      1
    )[0]!;
    return {
      ...base,
      kind: "hold",
      path: [point],
      cumulative: [0],
      totalLength: 0,
      checkpoints: [point],
      // A hold is worth exactly one unit of coverage: you were there, or you
      // were not. Holds count so a round of mostly-holds still has a
      // meaningful completion gate.
      checkpointsTotal: 1,
      checkpointRadius: config.holdRadius,
    };
  }

  // The converter already sampled the route through `sampleSegmentPath`, so
  // the graded line and the drawn line are the same object. The fallback is
  // pure defensiveness for a hand-built round.
  const path =
    segment.expectedPath.length >= 2
      ? [...segment.expectedPath]
      : sampleSegmentPath(segment.start, segment.end, config.pathSegments);
  const cumulative: number[] = [0];
  for (let i = 1; i < path.length; i++) {
    cumulative.push(cumulative[i - 1]! + distance(path[i - 1]!, path[i]!));
  }
  const totalLength = cumulative[cumulative.length - 1]!;
  // Evenly spaced by arc length; index 0 is the start point, which is where the
  // finger arms rather than something it has to reach, so it is dropped.
  const checkpoints = arcLengthResample(
    path,
    config.checkpointsPerSegment + 1
  ).slice(1);

  return {
    ...base,
    kind: "move",
    path,
    cumulative,
    totalLength,
    checkpoints,
    checkpointsTotal: checkpoints.length,
    checkpointRadius: effectiveCheckpointRadius(
      config.checkpointRadius,
      path,
      totalLength,
      checkpoints.length
    ),
  };
}

export function createTraceEvaluator(
  round: TraceRoundGeometry,
  config: TraceEvaluatorConfig = DEFAULT_TRACE_EVALUATOR_CONFIG
): TraceEvaluator {
  const beats = round.beats;

  // Participating hands come from the round's own geometry. Hand identity is
  // never inferred from pointer order anywhere in this feature.
  const handSet = new Set<TraceHand>();
  for (const beat of beats) {
    for (const key of Object.keys(beat.segments) as TraceHand[]) {
      if (beat.segments[key]) handSet.add(key);
    }
  }
  const hands: TraceHand[] = [...handSet];

  const slots: Slot[][] = beats.map((beat, beatIndex) =>
    hands.map((hand) => buildSlot(hand, beatIndex, beat.segments[hand], config))
  );

  const runtime = new Map<TraceHand, HandRuntime>(
    hands.map((hand) => [
      hand,
      {
        queue: [],
        lastPoint: null,
        lastKept: null,
        interruptions: 0,
        firstT: null,
        lastT: null,
      },
    ])
  );

  const divergences: TraceDivergence[] = [];
  let beatIndex = 0;
  let finished = false;

  const checkpointsTotal = slots
    .flat()
    .reduce((sum, slot) => sum + slot.checkpointsTotal, 0);

  function slotFor(hand: TraceHand, beat: number): Slot | undefined {
    if (beat < 0 || beat >= slots.length) return undefined;
    return slots[beat]!.find((s) => s.hand === hand);
  }

  function recordDivergence(
    hand: TraceHand,
    beat: number,
    reason: TraceDivergence["reason"],
    at: NormalizedPoint
  ): void {
    divergences.push({ hand, beatIndex: beat, reason, at: { ...at } });
  }

  function applyHold(slot: Slot, point: NormalizedPoint, t: number): void {
    const inside = distance(point, slot.path[0]!) <= config.holdRadius;
    if (inside) {
      slot.armed = true;
      slot.hitCount = 1;
      if (slot.satisfiedAtMs === null) slot.satisfiedAtMs = t;
      return;
    }
    if (slot.armed && !slot.holdBroken) {
      recordDivergence(slot.hand, slot.beatIndex, "hold-broken", point);
      slot.holdBroken = true;
    }
    // Leaving the zone un-satisfies the hand, which is what blocks the beat for
    // BOTH hands until the finger comes back.
    slot.satisfiedAtMs = null;
    slot.hitCount = 0;
  }

  function consume(slot: Slot, sample: TraceSample): void {
    const hand = runtime.get(slot.hand)!;
    const point: NormalizedPoint = { x: sample.x, y: sample.y };
    if (hand.firstT === null) hand.firstT = sample.t;
    hand.lastT = sample.t;
    slot.seen++;

    if (slot.kind === "hold") {
      hand.lastPoint = point;
      hand.lastKept = point;
      slot.actual.push(point);
      applyHold(slot, point, sample.t);
      return;
    }

    // Identical consecutive positions carry no new information and would let a
    // stationary high-frequency device inflate its own sample counts.
    const previous = hand.lastKept;
    hand.lastPoint = point;
    if (previous && previous.x === point.x && previous.y === point.y) return;
    hand.lastKept = point;

    if (!slot.armed) {
      if (distance(point, slot.path[0]!) <= config.startZoneRadius) {
        slot.armed = true;
        slot.actual.push(point);
        slot.lastArmedPoint = point;
        return;
      }
      // Riding the route without having started at its start is the classic
      // "traced it backwards" case: the shape is right, the journey is not.
      // Flag it the moment it happens so feedback can point at the start.
      if (!slot.wrongOrderRecorded) {
        const stray = projectOntoPolyline(
          point,
          slot.path,
          slot.cumulative,
          slot.totalLength
        );
        if (
          stray.distance <= config.corridorRadius &&
          stray.progress >= config.startBypassProgress
        ) {
          recordDivergence(slot.hand, slot.beatIndex, "wrong-order", point);
          slot.wrongOrderRecorded = true;
        }
      }
      return;
    }

    const from = slot.lastArmedPoint ?? point;
    slot.actual.push(point);
    slot.lastArmedPoint = point;

    const projection = projectOntoPolyline(
      point,
      slot.path,
      slot.cumulative,
      slot.totalLength
    );
    slot.comparisons++;
    const regressed =
      projection.progress < slot.maxProgress - config.regressionAllowance;
    if (regressed) {
      slot.regressions++;
    } else {
      slot.maxProgress = Math.max(slot.maxProgress, projection.progress);
    }

    if (projection.distance > config.corridorRadius) {
      slot.excursionSamples++;
      slot.excursionMax = Math.max(slot.excursionMax, projection.distance);
      if (slot.excursionSamples === 1) {
        recordDivergence(slot.hand, slot.beatIndex, "out-of-corridor", point);
      }
    }

    // The last checkpoint sits ON the end point, so it is landed with the end
    // point's own (deliberately more forgiving) tolerance. Landing a fingertip
    // on a target is worth being generous about; cutting a corner in the
    // middle of the route is not, which is why the rest stay tight.
    const radiusFor = (index: number): number =>
      index === slot.checkpoints.length - 1
        ? config.endZoneRadius
        : slot.checkpointRadius;

    if (!regressed) {
      // Consume checkpoints in order, and keep going: one fast sweep can
      // legitimately cross several small targets at once.
      let advanced = true;
      while (advanced && slot.nextCheckpoint < slot.checkpoints.length) {
        advanced = false;
        const target = slot.checkpoints[slot.nextCheckpoint]!;
        if (
          segmentIntersectsCircle(
            from,
            point,
            target,
            radiusFor(slot.nextCheckpoint)
          )
        ) {
          slot.nextCheckpoint++;
          slot.hitCount++;
          advanced = true;
        }
      }

      // Reaching a LATER checkpoint while an earlier one is still outstanding
      // is a shortcut, not credit.
      if (!slot.skipRecorded && slot.nextCheckpoint < slot.checkpoints.length) {
        for (
          let k = slot.nextCheckpoint + 1;
          k < slot.checkpoints.length;
          k++
        ) {
          if (
            segmentIntersectsCircle(
              from,
              point,
              slot.checkpoints[k]!,
              radiusFor(k)
            )
          ) {
            recordDivergence(
              slot.hand,
              slot.beatIndex,
              "skipped-checkpoint",
              point
            );
            slot.skipRecorded = true;
            break;
          }
        }
      }
    }

    const endPoint = slot.path[slot.path.length - 1]!;
    if (distance(point, endPoint) <= config.endZoneRadius) {
      // Arrival is independent of coverage on purpose: a player who cuts a
      // corner still gets to finish the round and see where they cut it,
      // rather than being stranded mid-beat with no way forward.
      slot.satisfiedAtMs = sample.t;
      if (!slot.skipRecorded && slot.hitCount < slot.checkpointsTotal) {
        recordDivergence(
          slot.hand,
          slot.beatIndex,
          "skipped-checkpoint",
          point
        );
        slot.skipRecorded = true;
      }
    }
  }

  function activateBeat(): void {
    if (beatIndex >= slots.length) return;
    for (const slot of slots[beatIndex]!) {
      if (slot.kind !== "hold") continue;
      const hand = runtime.get(slot.hand)!;
      // A hand already resting on the hold point satisfies immediately — the
      // player should not have to lift and re-place to prove they stayed.
      if (hand.lastPoint) applyHold(slot, hand.lastPoint, hand.lastT ?? 0);
    }
  }

  function allSatisfied(): boolean {
    if (beatIndex >= slots.length) return false;
    return slots[beatIndex]!.every(
      (slot) => slot.kind === "absent" || slot.satisfiedAtMs !== null
    );
  }

  function drain(): void {
    let progressed = true;
    while (progressed) {
      progressed = false;

      for (const hand of hands) {
        const slot = slotFor(hand, beatIndex);
        if (!slot || slot.kind === "absent") continue;
        const state = runtime.get(hand)!;

        if (slot.kind === "hold") {
          // A holding hand watches every sample it has: it can leave the zone
          // at any moment, and that has to be noticed immediately.
          while (state.queue.length > 0) {
            consume(slot, state.queue.shift()!);
            progressed = true;
          }
        } else {
          // A moving hand stops consuming the instant it arrives. Whatever is
          // left in the queue belongs to the next beat and waits for the gate.
          while (slot.satisfiedAtMs === null && state.queue.length > 0) {
            consume(slot, state.queue.shift()!);
            progressed = true;
          }
        }
      }

      if (allSatisfied()) {
        beatIndex++;
        activateBeat();
        progressed = true;
      }
    }
  }

  activateBeat();

  function buildExcursions(): CorridorExcursion[] {
    return slots
      .flat()
      .filter((slot) => slot.excursionSamples > 0)
      .map((slot) => ({
        hand: slot.hand,
        beatIndex: slot.beatIndex,
        maxDistance: slot.excursionMax,
        sampleCount: slot.excursionSamples,
      }));
  }

  function checkpointsHit(): number {
    return slots.flat().reduce((sum, slot) => sum + slot.hitCount, 0);
  }

  return {
    ingest(hand: TraceHand, samples: readonly TraceSample[]): void {
      if (finished) return;
      const state = runtime.get(hand);
      if (!state) return;
      state.queue.push(...samples);
      drain();
    },

    notifyLift(hand: TraceHand): void {
      if (finished) return;
      const slot = slotFor(hand, beatIndex);
      if (!slot || slot.kind === "absent") return;
      if (slot.satisfiedAtMs !== null || slot.lifted) return;
      slot.lifted = true;
      const state = runtime.get(hand)!;
      recordDivergence(
        hand,
        slot.beatIndex,
        "lifted",
        state.lastPoint ?? slot.path[0] ?? { x: 0, y: 0 }
      );
    },

    notifyInterruption(hand: TraceHand): void {
      if (finished) return;
      const state = runtime.get(hand);
      if (!state) return;
      // A cancel is a PAUSE. No divergence, no continuity penalty, no loss of
      // armed state — the player picks up exactly where they were.
      state.interruptions++;
    },

    get state(): TraceEvaluatorState {
      const armed: Partial<Record<TraceHand, boolean>> = {};
      const satisfied: Partial<Record<TraceHand, boolean>> = {};
      for (const hand of hands) {
        const slot = slotFor(hand, beatIndex);
        armed[hand] = slot?.armed ?? false;
        satisfied[hand] = slot ? slot.satisfiedAtMs !== null : false;
      }
      return {
        beatIndex,
        completedBeats: beatIndex,
        totalBeats: beats.length,
        hands: [...hands],
        armed,
        satisfied,
        checkpointsHit: checkpointsHit(),
        checkpointsTotal,
        divergences: [...divergences],
        excursions: buildExcursions(),
      };
    },

    finish(): TraceMetrics {
      if (!finished) {
        finished = true;
        // A hand that produced samples but never entered the start zone did the
        // route in the wrong order (most often: it started at the far end).
        for (const slot of slots.flat()) {
          if (slot.kind !== "move") continue;
          if (slot.armed || slot.seen === 0 || slot.wrongOrderRecorded) continue;
          const state = runtime.get(slot.hand)!;
          slot.wrongOrderRecorded = true;
          recordDivergence(
            slot.hand,
            slot.beatIndex,
            "wrong-order",
            state.lastPoint ?? slot.path[0]!
          );
        }
      }

      const allSlots = slots.flat();
      const activeSlots = allSlots.filter((slot) => slot.kind !== "absent");

      const hit = checkpointsHit();
      const coverage = checkpointsTotal === 0 ? 1 : hit / checkpointsTotal;

      // Accuracy — order-sensitive shape agreement, averaged over the moving
      // segments the player actually attempted. The canonical route is cut to
      // the furthest point the finger reached so accuracy answers "how good
      // was the line you drew", not "how much of it did you draw" — the second
      // question is coverage's, and it already has a hard gate.
      const measured = allSlots.filter(
        (slot) => slot.kind === "move" && slot.actual.length >= 2
      );
      let frechetNormalized = 0;
      let accuracy = 0;
      if (measured.length > 0) {
        let sum = 0;
        for (const slot of measured) {
          const actual = arcLengthResample(slot.actual, config.frechetSamples);
          const canonical = arcLengthResample(
            truncatePolyline(slot.path, slot.maxProgress),
            config.frechetSamples
          );
          sum += normalizeStageDistance(discreteFrechet(actual, canonical));
        }
        frechetNormalized = sum / measured.length;
        accuracy = clamp01(1 - frechetNormalized / config.accuracyFalloff);
      }

      // Continuity — deliberate lifts dominate; fingertip jitter nudges.
      const liftedSlots = activeSlots.filter((slot) => slot.lifted).length;
      const totalComparisons = activeSlots.reduce(
        (sum, slot) => sum + slot.comparisons,
        0
      );
      const totalRegressions = activeSlots.reduce(
        (sum, slot) => sum + slot.regressions,
        0
      );
      const liftFraction =
        activeSlots.length === 0 ? 0 : liftedSlots / activeSlots.length;
      const regressionFraction =
        totalComparisons === 0 ? 0 : totalRegressions / totalComparisons;
      const continuity = clamp01(
        1 - liftFraction - config.regressionPenalty * regressionFraction
      );

      // Synchrony — only meaningful on beats where more than one hand took
      // part AND every participant's own path came out valid. Grading timing
      // against a path that failed on its own terms would double-punish.
      const syncBeats: number[] = [];
      for (let b = 0; b < slots.length; b++) {
        const participants = slots[b]!.filter((slot) => slot.kind !== "absent");
        if (participants.length < 2) continue;
        const valid = participants.every(
          (slot) => slot.satisfiedAtMs !== null && !slot.lifted
        );
        if (!valid) continue;
        const times = participants.map((slot) => slot.satisfiedAtMs!);
        const spread = Math.max(...times) - Math.min(...times);
        syncBeats.push(
          clamp01(1 - spread / Math.max(1, config.synchronyToleranceMs))
        );
      }
      const synchrony =
        syncBeats.length === 0
          ? null
          : syncBeats.reduce((a, b) => a + b, 0) / syncBeats.length;

      let firstT = Number.POSITIVE_INFINITY;
      let lastT = Number.NEGATIVE_INFINITY;
      for (const state of runtime.values()) {
        if (state.firstT !== null) firstT = Math.min(firstT, state.firstT);
        if (state.lastT !== null) lastT = Math.max(lastT, state.lastT);
      }
      const elapsedMs = Number.isFinite(firstT) && Number.isFinite(lastT)
        ? lastT - firstT
        : 0;

      return {
        coverage,
        accuracy,
        continuity,
        synchrony,
        frechetNormalized,
        corridorExcursions: buildExcursions(),
        checkpointsHit: hit,
        checkpointsTotal,
        elapsedMs,
        // The metrics contract carries the FIRST divergence: results copy
        // names one thing that went wrong, not a list to defend against. The
        // full ordered list stays available on `state.divergences` for a
        // detailed review view.
        divergence: divergences[0] ?? null,
      };
    },
  };
}
