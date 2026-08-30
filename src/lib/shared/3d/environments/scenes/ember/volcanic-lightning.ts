/**
 * Volcanic lightning timing for the Ember haze dome.
 *
 * The dome's cloud noise drifts on a heavily scaled clock (`animationSpeed` is
 * around 0.03), so one "shader second" is roughly half a minute of wall time.
 * Lightning cannot ride that clock: `lightningInterval` is authored as seconds
 * between flashes, and a strike only reads as lightning when it lasts a
 * fraction of a real second. The two clocks are therefore separate, and this
 * module owns the real-time one.
 */

export interface VolcanicLightningSample {
  /** Flash brightness in [0, 1], before the look's `lightningIntensity`. */
  energy: number;
  /** Index of the flash cycle this sample belongs to. */
  cycle: number;
}

/** Envelope shape, in real seconds. Shared by every look. */
const STROKE_SECONDS = 0.09;
const AFTERGLOW_SECONDS = 0.55;
const AFTERGLOW_PEAK = 0.22;

/** Return strokes, offset from the leader and dimmer than it. */
const RETURN_STROKES: readonly { readonly at: number; readonly gain: number }[] =
  [
    { at: 0.14, gain: 0.72 },
    { at: 0.27, gain: 0.45 },
  ];

/** Below this, an interval would strobe rather than flash. */
export const MIN_LIGHTNING_INTERVAL_SECONDS = 0.5;

/** Keeps the shader's noise lookup in a range mediump can still resolve. */
const CELL_SPAN = 16;

function strokeEnvelope(secondsSinceStroke: number, gain: number): number {
  if (secondsSinceStroke < 0 || secondsSinceStroke >= STROKE_SECONDS) return 0;
  const remaining = 1 - secondsSinceStroke / STROKE_SECONDS;
  return remaining * remaining * remaining * gain;
}

/**
 * Samples the flash envelope at `elapsedSeconds` of real time.
 *
 * The envelope is expressed in absolute seconds, so changing the interval
 * changes how often lightning fires without changing how a strike looks.
 */
export function sampleVolcanicLightning(
  elapsedSeconds: number,
  intervalSeconds: number
): VolcanicLightningSample {
  const interval = Math.max(
    intervalSeconds,
    MIN_LIGHTNING_INTERVAL_SECONDS
  );
  const elapsed = Math.max(elapsedSeconds, 0);
  const cycle = Math.floor(elapsed / interval);
  const phase = elapsed - cycle * interval;

  let energy = strokeEnvelope(phase, 1);
  for (const stroke of RETURN_STROKES) {
    energy = Math.max(energy, strokeEnvelope(phase - stroke.at, stroke.gain));
  }

  if (phase < AFTERGLOW_SECONDS) {
    const decay = 1 - phase / AFTERGLOW_SECONDS;
    energy = Math.max(energy, decay * decay * AFTERGLOW_PEAK);
  }

  return { energy: Math.min(energy, 1), cycle };
}

/**
 * Bounded noise offset that decides where in the dome a cycle's flash sits.
 *
 * The cycle index grows without limit, and feeding it straight into a simplex
 * lookup pushes the sample coordinate past what a mobile mediump float can
 * resolve, which freezes the flash in one place. Hashing it into a small span
 * keeps every cycle distinct and every coordinate small.
 */
export function volcanicLightningCell(
  cycle: number
): [number, number, number] {
  const base = Math.abs(Math.trunc(cycle));
  const hash = (salt: number): number => {
    const value = Math.sin((base + 1) * salt) * 43758.5453;
    return (value - Math.floor(value)) * CELL_SPAN;
  };
  return [hash(12.9898), hash(78.233), hash(37.719)];
}
