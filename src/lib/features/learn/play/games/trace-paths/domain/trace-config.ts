/**
 * Trace Paths — tolerances and weights.
 *
 * EVERY NUMBER IN THIS FILE IS AN UNTUNED PROTOTYPE BASELINE. They were
 * reasoned about, not measured. Nobody has yet drawn a single real trace on a
 * real phone with a real thumb, and the first session of that will move most
 * of these. Treat them as the thing to calibrate, not as settled physics —
 * when real-device traces exist, retune here and nowhere else.
 *
 * Two rules hold regardless of tuning:
 *
 * 1. Tolerances are NORMALIZED — a fraction of the stage's side, 0..1. Never a
 *    raw pixel constant. A 24px corridor is generous on a phone and invisible
 *    on a 4K monitor; 0.075 of the stage is the same forgiveness everywhere.
 *
 * 2. A normalized tolerance still has a physical floor. On a small screen the
 *    normalized corridor can shrink below the width of the finger drawing it,
 *    at which point the game is asking for precision the hardware cannot
 *    report. `withPhysicalFloor` raises any tolerance to at least
 *    TRACE_MIN_TOUCH_TOLERANCE_MM of real-world millimetres.
 */

/**
 * Half-width of the corridor around a route's spine. A sample inside this band
 * is on the path; outside it starts a corridor excursion.
 *
 * 0.075 = 7.5% of the stage side to either side, so a 15%-of-stage-wide ribbon.
 * Chosen to be wider than the visual stroke so the corridor is forgiving of
 * the stroke's own thickness rather than punishing it.
 */
export const TRACE_CORRIDOR_HALF_WIDTH = 0.075;

/**
 * How close a sample must pass to a checkpoint to count as hitting it.
 * Slightly tighter than the corridor: you may wobble along the route, but you
 * must actually go THROUGH its waypoints, in order — that is what makes this a
 * trace and not a scribble in the right neighbourhood.
 */
export const TRACE_CHECKPOINT_RADIUS = 0.06;

/**
 * How far back along the route a hand may drift before it counts as reversing.
 * Progress along a segment is monotonic by design; hands jitter, though, and a
 * pointer that stalls mid-stroke reports a few samples of noise in both
 * directions. Expressed as a fraction of the segment's own arc length.
 */
export const TRACE_PROGRESS_REGRESSION_ALLOWANCE = 0.08;

/**
 * Radius a held hand may drift within and still be holding. Deliberately
 * larger than the checkpoint radius: holding still for a whole beat with an
 * unsupported arm is harder than passing through a point, and punishing
 * natural sway would be punishing anatomy.
 */
export const TRACE_HOLD_ZONE_RADIUS = 0.07;

/**
 * The physical floor, in millimetres of real screen.
 *
 * A fingertip contact patch is roughly 8-10mm across, and touch hardware
 * reports its centroid with a few millimetres of slop. Asking for tighter than
 * this is asking for precision the device does not have, so no normalized
 * tolerance is allowed to resolve below it. Millimetres, not pixels, on
 * purpose: pixels are not a physical unit across DPRs.
 */
export const TRACE_MIN_TOUCH_TOLERANCE_MM = 6;

/**
 * Raise a normalized tolerance so it never resolves below the physical touch
 * floor on a small stage.
 *
 * @param normalized  A 0..1 fraction of the stage side (one of the constants above).
 * @param stageSideMm The rendered stage's side length in millimetres. Pass 0 or
 *                    a non-finite value when the physical size is unknown and
 *                    the normalized value is returned untouched.
 */
export function withPhysicalFloor(
  normalized: number,
  stageSideMm: number
): number {
  if (!Number.isFinite(stageSideMm) || stageSideMm <= 0) return normalized;
  return Math.max(normalized, TRACE_MIN_TOUCH_TOLERANCE_MM / stageSideMm);
}

/**
 * How far apart the two hands' beat transitions may land and still read as
 * together. Two hands arriving within this window are synchronized; beyond it
 * the synchrony score falls off.
 *
 * 180ms is about the low end of what a viewer perceives as "at the same time"
 * for two simultaneous events, which is the thing being scored — whether it
 * LOOKED together, not whether it was sample-accurate.
 */
export const TRACE_SYNCHRONY_WINDOW_MS = 180;

/**
 * How the three scored dimensions combine into one quality number.
 *
 * Accuracy dominates because drawing the right route is the task. Continuity
 * matters next — a route drawn in six lifted stabs is not the same skill as
 * one drawn in a stroke. Synchrony is real but weighted least: it is null on
 * single-hand rounds, and on two-hand rounds it is the dimension a beginner
 * loses first, so it should not swamp the other two.
 *
 * Must sum to 1. The assertion below is a build-time tripwire on that.
 */
export const TRACE_QUALITY_WEIGHTS = {
  accuracy: 0.6,
  continuity: 0.25,
  synchrony: 0.15,
} as const;

// Tripwire: if someone retunes the weights and forgets to rebalance, this
// throws at module load instead of quietly producing scores over 1.
const WEIGHT_SUM =
  TRACE_QUALITY_WEIGHTS.accuracy +
  TRACE_QUALITY_WEIGHTS.continuity +
  TRACE_QUALITY_WEIGHTS.synchrony;
if (Math.abs(WEIGHT_SUM - 1) > 1e-9) {
  throw new Error(
    `TRACE_QUALITY_WEIGHTS must sum to 1, got ${WEIGHT_SUM}. Rebalance them.`
  );
}

/**
 * How many points to sample along one move segment when building its expected
 * path. Dense enough that the polyline hugs a curved (arc / concave) route
 * rather than chording across it, cheap enough to run for every segment of
 * every round at conversion time.
 */
export const TRACE_PATH_SAMPLE_COUNT = 24;
