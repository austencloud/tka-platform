const BLOOM_INTENSITY_GAMMA = 2.6;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * The Bloom slider controls perceived exposure, not raw additive alpha.
 * Without this curve, the first fifth of the track does all the useful work
 * and everything above it clips toward white.
 */
export function perceptualBloomIntensity(intensity: number): number {
  return Math.pow(clamp01(intensity), BLOOM_INTENSITY_GAMMA);
}

/** One clock shared by both renderers keeps pulse timing visually equivalent. */
export function resolveBloomExposure(
  intensity: number,
  pulse: number,
  pulseRate: number,
  timeSeconds: number
): number {
  const pulseAmount = clamp01(pulse);
  const pulseFactor =
    1 -
    pulseAmount +
    pulseAmount * (0.5 + 0.5 * Math.sin(timeSeconds * pulseRate * Math.PI * 2));
  return clamp01(perceptualBloomIntensity(intensity) * pulseFactor);
}

/**
 * The afterglow buffer stores scattered light, not the live source. Zero means
 * no history at all; higher values extend the exposure without approaching an
 * immortal buffer.
 */
export function resolveBloomAfterglowRetention(afterglow: number): number {
  const amount = clamp01(afterglow);
  if (amount <= 0) return 0;
  return 0.72 + amount * 0.27;
}

/**
 * Deposit falls as retention rises, so a longer exposure does not become a
 * brighter exposure merely because the same light survives more frames.
 */
export function resolveBloomHistoryDeposit(afterglow: number): number {
  const amount = clamp01(afterglow);
  const retention = resolveBloomAfterglowRetention(amount);
  if (retention <= 0) return 0;
  const targetHistoryEnergy = 0.18 + amount * 0.82;
  return (1 - retention) * targetHistoryEnergy;
}

/**
 * Large formations need a smaller optical footprint, not fewer lights. This
 * keeps every prop readable while preventing sixteen spectral trails from
 * covering the choreography underneath them.
 */
export function resolveBloomFootprintScale(propCount: number): number {
  const count = Math.max(1, Math.floor(propCount));
  return Math.max(0.55, Math.pow(count, -0.22));
}
