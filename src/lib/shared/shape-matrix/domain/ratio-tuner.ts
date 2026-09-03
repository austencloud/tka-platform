/**
 * The tuner turns the atlas from a list of thirty shapes into one continuous
 * line you can slide along.
 *
 * The atlas ratios are the Farey sequence of order nine, so their positions on
 * a linear 0..1 line are not decoration: the gaps between them ARE the theory.
 * Simple ratios sit far apart with wide empty approaches, complicated ones
 * crowd together, and sliding across that spacing is what teaches why 1:2 and
 * 2:3 read as landmarks while 4:9 and 5:9 read as near-misses of something
 * simpler.
 *
 * A value between two stops is not an error state. It is a rate whose path
 * never closes, which is the honest answer to "what is between these two
 * flowers".
 */

import {
  buildBoundedSpinRatios,
  makeSpinRatio,
  spinRatioKey,
  type SpinRatio,
} from "@vtg/domain";

/** Farey order the atlas publishes. Denominators run 1..9. */
export const TUNER_ORDER = 9;

export interface RatioStop {
  ratio: SpinRatio;
  key: string;
  /** Position on the 0..1 tuner line. Exactly propRotations / handCycles. */
  value: number;
  /** 1 for unit ratios and halves, falling toward 0 for ninths. */
  prominence: number;
}

/**
 * The finite stops, in order.
 *
 * 1:0 is deliberately absent. A stationary hand is a different kind of motion,
 * not a faster rate, and parking it past 1:1 would put those two kinds on one
 * axis. It stays its own control.
 */
export function buildRatioStops(order = TUNER_ORDER): RatioStop[] {
  return buildBoundedSpinRatios(order).map((ratio) => ({
    ratio,
    key: spinRatioKey(ratio),
    value: ratio.propRotations / ratio.handCycles,
    prominence: stopProminence(ratio, order),
  }));
}

/**
 * How strongly a stop announces itself, from its denominator alone.
 *
 * Denominator is the right measure because it is what the eye reads: a ratio
 * over 2 closes in two hand cycles and resolves instantly, one over 9 takes
 * nine and arrives looking like a smudged version of something simpler.
 */
export function stopProminence(ratio: SpinRatio, order = TUNER_ORDER): number {
  const reduced = makeSpinRatio(ratio.propRotations, ratio.handCycles);
  const depth = Math.max(1, reduced.handCycles);
  if (order <= 1) return 1;
  return 1 - (depth - 1) / (order - 1);
}

/** The stop nearest a tuner value, and how far away it is. */
export function nearestStop(
  stops: readonly RatioStop[],
  value: number
): { stop: RatioStop; distance: number } {
  let best = stops[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const stop of stops) {
    const distance = Math.abs(stop.value - value);
    if (distance < bestDistance) {
      best = stop;
      bestDistance = distance;
    }
  }
  return { stop: best, distance: bestDistance };
}

/**
 * Detent radius for a stop, in tuner units.
 *
 * One global radius is wrong here. Ninths sit as close as 1/72 apart, so a
 * radius wide enough to feel magnetic at 1:2 would swallow four stops at the
 * crowded end. Scaling with prominence gives 1:2 a wide obvious well and
 * leaves 4:9 a narrow one you have to mean.
 */
export function detentRadius(stop: RatioStop): number {
  return 0.004 + stop.prominence * 0.011;
}

/** Snap onto a stop when the value is inside that stop's well. */
export function snapToStop(
  stops: readonly RatioStop[],
  value: number
): RatioStop | null {
  const { stop, distance } = nearestStop(stops, value);
  return distance <= detentRadius(stop) ? stop : null;
}

/** The two stops a free value sits between, for an honest readout. */
export function bracketStops(
  stops: readonly RatioStop[],
  value: number
): { below: RatioStop | null; above: RatioStop | null } {
  let below: RatioStop | null = null;
  let above: RatioStop | null = null;
  for (const stop of stops) {
    if (stop.value <= value) below = stop;
    if (stop.value >= value && !above) above = stop;
  }
  return { below, above };
}

/**
 * Where the next arrow-key press lands.
 *
 * Arrow keys walk stop to stop rather than by a fixed increment. Keyboard use
 * of this control means "show me the next real shape"; pointer dragging
 * already owns the continuous reading, and a hundredth-of-a-unit nudge would
 * only ever land between two shapes.
 */
export function stepStop(
  stops: readonly RatioStop[],
  value: number,
  direction: 1 | -1
): RatioStop | null {
  const epsilon = 1e-9;
  const ordered = direction === 1 ? stops : [...stops].reverse();
  return (
    ordered.find((stop) =>
      direction === 1
        ? stop.value > value + epsilon
        : stop.value < value - epsilon
    ) ?? null
  );
}
