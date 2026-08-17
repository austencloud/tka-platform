/** Quietest value reported, so silence never produces negative infinity. */
const SILENCE_FLOOR_DB = -100;

/** Human speech F0 range. Narrow enough to reject octave errors on noise. */
const MIN_F0_HZ = 70;
const MAX_F0_HZ = 350;

/** Correlation below this reads as unvoiced rather than a weak pitch. */
const MIN_CORRELATION = 0.3;

/** Window measured at each edge for the join cost. */
const EDGE_WINDOW_SECONDS = 0.06;

/**
 * How far the edge window may walk inward looking for voicing. A token that
 * opens on a fricative — Sigma, Psi, Theta, Tau, Phi, Chi, Xi — has no pitch
 * at its first sample, and the segmenter's own padding puts silence there
 * besides. Reporting the unvoiced sentinel for those would hand the selector a
 * 0 Hz start against a ~130 Hz neighbour, a join cost of 1.3 that outranks a
 * full coarticulation mismatch. Walking inward finds the pitch a listener
 * actually hears at that edge.
 */
const EDGE_SEARCH_LIMIT_SECONDS = 0.2;
const EDGE_SEARCH_STEP_SECONDS = 0.03;

/**
 * How far below the best correlation a sub-multiple lag may score and still be
 * preferred. Bare argmax returns exact octave-down errors whenever the true
 * period is not a whole number of samples: at 147 Hz and 48 kHz the period is
 * 326.5 samples, so lag 653 lands on a whole number of periods and scores
 * 0.99996 while the true lag 326 scores lower. Measured across 80-345 Hz at
 * three window lengths and three spectral profiles, 0.02 recovers every case
 * without ever picking a lag that is too short.
 */
const SUBMULTIPLE_TOLERANCE = 0.02;

/**
 * Sub-multiples checked. 70-350 Hz is a factor of five, so a lag five times the
 * true period is the largest error the bounded search can hold.
 */
const MAX_SUBMULTIPLE = 5;

export interface TokenFeatures {
  durationMs: number;
  rmsDb: number;
  f0StartHz: number;
  f0EndHz: number;
  /**
   * Level over the same edge windows the F0 readings come from. The manifest
   * stores only whole-token `rmsDb` today; these are measured so the recording
   * session's own numbers can settle whether the join cost should move to edge
   * level before a bank exists to re-measure.
   */
  rmsStartDb: number;
  rmsEndDb: number;
}

/**
 * A single NaN or Infinity anywhere in a decoded buffer would otherwise
 * propagate to `rmsDb`, fail the manifest parser's finite check, and take the
 * entire bank down — every word in the app falls back to synthetic speech
 * because one token's WAV was corrupt. Treating the sample as silent keeps the
 * damage to the one token it came from.
 */
function finiteSample(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) ? value : 0;
}

function meanOf(samples: Float32Array): number {
  let total = 0;
  for (let index = 0; index < samples.length; index++) {
    total += finiteSample(samples[index]);
  }
  return total / samples.length;
}

/**
 * RMS level in dBFS, measured about the signal's own mean. A recording chain
 * with DC offset otherwise reports the offset as loudness: 0.3 of DC and
 * nothing else measures -10.5 dB while being silent to the ear.
 */
export function measureRmsDb(samples: Float32Array): number {
  if (samples.length === 0) return SILENCE_FLOOR_DB;

  const mean = meanOf(samples);

  let sumSquares = 0;
  for (let index = 0; index < samples.length; index++) {
    const sample = finiteSample(samples[index]) - mean;
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
 *
 * Normalisation alone does not prevent octave errors, because they do not come
 * from energy — they come from lag quantisation. See `SUBMULTIPLE_TOLERANCE`.
 */
export function estimateF0Hz(
  samples: Float32Array,
  sampleRate: number
): number | null {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) return null;

  const minLag = Math.floor(sampleRate / MAX_F0_HZ);
  const maxLag = Math.floor(sampleRate / MIN_F0_HZ);
  if (minLag < 1 || samples.length < maxLag * 2) return null;

  const mean = meanOf(samples);
  const centred = new Float32Array(samples.length);
  for (let index = 0; index < samples.length; index++) {
    centred[index] = finiteSample(samples[index]) - mean;
  }

  const scores = new Float64Array(maxLag + 1).fill(Number.NEGATIVE_INFINITY);
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
    scores[lag] = score;
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }

  if (bestLag < 0) return null;

  // Division by `chosenLag` below is safe because `minLag >= 1` was checked
  // above and every candidate lag is at least `minLag`.
  const chosenLag = shortestPlausiblePeriod(scores, bestLag, bestScore, minLag);
  return sampleRate / chosenLag;
}

/**
 * Walk the sub-multiples of the winning lag from shortest upward and take the
 * first that still correlates nearly as well. Each sub-multiple is checked
 * across a one-sample neighbourhood, because a true period of 326.5 samples
 * lands on neither 326 nor 327 exactly and would otherwise be missed.
 */
function shortestPlausiblePeriod(
  scores: Float64Array,
  bestLag: number,
  bestScore: number,
  minLag: number
): number {
  const floor = bestScore - SUBMULTIPLE_TOLERANCE * Math.abs(bestScore);

  for (let divisor = MAX_SUBMULTIPLE; divisor >= 2; divisor--) {
    const centre = Math.round(bestLag / divisor);
    if (centre < minLag) continue;

    let localLag = -1;
    let localScore = Number.NEGATIVE_INFINITY;
    for (let lag = centre - 1; lag <= centre + 1; lag++) {
      if (lag < minLag || lag >= scores.length) continue;
      const score = scores[lag] ?? Number.NEGATIVE_INFINITY;
      if (score > localScore) {
        localScore = score;
        localLag = lag;
      }
    }

    if (localLag > 0 && localScore >= floor && localScore >= MIN_CORRELATION) {
      return localLag;
    }
  }

  return bestLag;
}

/**
 * Fraction of a token's peak that counts as the start of speech. The
 * segmenter's padding is sub-threshold audio by construction, so a
 * peak-relative floor lands on the speech onset without this module needing to
 * know the segmenter's constants.
 */
const ONSET_PEAK_FRACTION = 0.05;

interface EdgeMeasurement {
  f0Hz: number;
  rmsDb: number;
}

function peakOf(samples: Float32Array): number {
  let peak = 0;
  for (let index = 0; index < samples.length; index++) {
    const magnitude = Math.abs(finiteSample(samples[index]));
    if (magnitude > peak) peak = magnitude;
  }
  return peak;
}

/**
 * Index of the first sample at one end that rises above the onset floor —
 * where the speech in this token actually begins, past the padding the
 * segmenter added.
 */
function speechOnsetIndex(samples: Float32Array, fromEnd: boolean): number {
  const threshold = peakOf(samples) * ONSET_PEAK_FRACTION;
  if (threshold <= 0) return fromEnd ? samples.length - 1 : 0;

  if (fromEnd) {
    for (let index = samples.length - 1; index >= 0; index--) {
      if (Math.abs(finiteSample(samples[index])) >= threshold) return index;
    }
    return samples.length - 1;
  }

  for (let index = 0; index < samples.length; index++) {
    if (Math.abs(finiteSample(samples[index])) >= threshold) return index;
  }
  return 0;
}

/**
 * Measure one edge of a token, walking inward until the signal is voiced and
 * reporting pitch AND level from that same window.
 *
 * The window is anchored at the speech onset rather than at the literal first
 * sample. `EDGE_PADDING_SECONDS` is 35 ms of deliberately sub-threshold audio,
 * more than half of a 60 ms window, and pitch estimation succeeds on a window
 * that is mostly padding — so anchoring at sample 0 measured every token as
 * roughly 4 dB quieter at its edges than it really is, for a reason that has
 * nothing to do with how loudly it was spoken.
 *
 * The two searches are deliberately NOT capped at the token's midpoint. A
 * midpoint cap sounds prudent and is not: on a token that opens with a long
 * fricative it stops the walk before it reaches the voicing behind it and
 * reports the unvoiced sentinel even though the token has a pitch. The
 * condition it would guard — both searches converging on a single voiced island
 * in the middle — is one where reporting that island's pitch at both edges is
 * simply correct, because it is the only pitch the token has.
 */
function measureEdge(
  samples: Float32Array,
  sampleRate: number,
  fromEnd: boolean
): EdgeMeasurement {
  const window = Math.min(
    samples.length,
    Math.round(sampleRate * EDGE_WINDOW_SECONDS)
  );
  const step = Math.max(1, Math.round(sampleRate * EDGE_SEARCH_STEP_SECONDS));
  const limit = Math.round(sampleRate * EDGE_SEARCH_LIMIT_SECONDS);

  const onset = speechOnsetIndex(samples, fromEnd);
  const anchor = fromEnd
    ? Math.min(samples.length - window, Math.max(0, onset + 1 - window))
    : Math.min(Math.max(0, onset), Math.max(0, samples.length - window));

  const startFor = (offset: number) =>
    fromEnd ? anchor - offset : anchor + offset;

  for (let offset = 0; offset <= limit; offset += step) {
    const start = startFor(offset);
    if (start < 0 || start + window > samples.length) break;

    const slice = samples.slice(start, start + window);
    const estimate = estimateF0Hz(slice, sampleRate);
    if (estimate !== null) {
      return { f0Hz: estimate, rmsDb: measureRmsDb(slice) };
    }
  }

  // Nothing voiced within reach. Report the outermost window's level so the
  // reading is still about this edge, and the unvoiced sentinel for pitch.
  const fallbackStart = Math.max(0, startFor(0));
  return {
    f0Hz: 0,
    rmsDb: measureRmsDb(samples.slice(fallbackStart, fallbackStart + window)),
  };
}

export function measureTokenFeatures(
  samples: Float32Array,
  sampleRate: number
): TokenFeatures {
  const start = measureEdge(samples, sampleRate, false);
  const end = measureEdge(samples, sampleRate, true);

  return {
    durationMs: (samples.length / sampleRate) * 1000,
    rmsDb: measureRmsDb(samples),
    f0StartHz: start.f0Hz,
    f0EndHz: end.f0Hz,
    rmsStartDb: start.rmsDb,
    rmsEndDb: end.rmsDb,
  };
}
