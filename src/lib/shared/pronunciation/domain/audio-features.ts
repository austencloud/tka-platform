/** Quietest value reported, so silence never produces negative infinity. */
const SILENCE_FLOOR_DB = -100;

/** Human speech F0 range. Narrow enough to reject octave errors on noise. */
const MIN_F0_HZ = 70;
const MAX_F0_HZ = 350;

/** Correlation below this reads as unvoiced rather than a weak pitch. */
const MIN_CORRELATION = 0.3;

/** Window measured at each edge for the join cost. */
const EDGE_WINDOW_SECONDS = 0.06;

export interface TokenFeatures {
  durationMs: number;
  rmsDb: number;
  f0StartHz: number;
  f0EndHz: number;
}

export function measureRmsDb(samples: Float32Array): number {
  if (samples.length === 0) return SILENCE_FLOOR_DB;

  let sumSquares = 0;
  for (let index = 0; index < samples.length; index++) {
    const sample = samples[index] ?? 0;
    sumSquares += sample * sample;
  }

  const rms = Math.sqrt(sumSquares / samples.length);
  if (rms <= 0) return SILENCE_FLOOR_DB;
  return Math.max(SILENCE_FLOOR_DB, 20 * Math.log10(rms));
}

/**
 * Normalised autocorrelation pitch estimate. Normalising by the energy of both
 * windows keeps the score comparable across lags, so a loud low-frequency lag
 * cannot outscore the true period.
 */
export function estimateF0Hz(
  samples: Float32Array,
  sampleRate: number
): number | null {
  const minLag = Math.floor(sampleRate / MAX_F0_HZ);
  const maxLag = Math.floor(sampleRate / MIN_F0_HZ);
  if (samples.length < maxLag * 2) return null;

  let mean = 0;
  for (let index = 0; index < samples.length; index++) {
    mean += samples[index] ?? 0;
  }
  mean /= samples.length;

  const centred = new Float32Array(samples.length);
  for (let index = 0; index < samples.length; index++) {
    centred[index] = (samples[index] ?? 0) - mean;
  }

  let bestLag = -1;
  let bestScore = MIN_CORRELATION;

  for (let lag = minLag; lag <= maxLag; lag++) {
    let product = 0;
    let energyLeft = 0;
    let energyRight = 0;

    for (let index = 0; index + lag < centred.length; index++) {
      const left = centred[index] ?? 0;
      const right = centred[index + lag] ?? 0;
      product += left * right;
      energyLeft += left * left;
      energyRight += right * right;
    }

    const denominator = Math.sqrt(energyLeft * energyRight);
    if (denominator <= 0) continue;

    const score = product / denominator;
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }

  return bestLag > 0 ? sampleRate / bestLag : null;
}

export function measureTokenFeatures(
  samples: Float32Array,
  sampleRate: number
): TokenFeatures {
  const window = Math.min(
    samples.length,
    Math.round(sampleRate * EDGE_WINDOW_SECONDS)
  );

  return {
    durationMs: (samples.length / sampleRate) * 1000,
    rmsDb: measureRmsDb(samples),
    f0StartHz: estimateF0Hz(samples.slice(0, window), sampleRate) ?? 0,
    f0EndHz:
      estimateF0Hz(samples.slice(samples.length - window), sampleRate) ?? 0,
  };
}
