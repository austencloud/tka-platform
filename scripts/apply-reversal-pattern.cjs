"use strict";

/**
 * Reversal Pattern Transformation
 *
 * Applies a named reversal pattern to an array of sequence steps, flipping
 * pro↔anti motion types according to per-beat R/B/P/- instructions.
 *
 * This is a CJS module so it can be required by Node scripts (enumerate-deck.cjs,
 * seed scripts) that can't import TypeScript directly.
 */

// Pattern definitions (inlined from TypeScript config — keep in sync)

/**
 * All 15 reversal patterns.
 *
 * sequence — string of symbols: P (both), R (red), B (blue), - (neither)
 * period   — number of beats before the pattern logically repeats
 *
 * The sequence string itself wraps via modulo, so period is metadata for
 * display and filtering rather than something enforced at the code level.
 */
const REVERSAL_PATTERNS = {
  "continuous":    { sequence: "----", period: 1 },
  "book":          { sequence: "PPPP", period: 1 },
  "red-book":      { sequence: "RRRR", period: 1 },
  "blue-book":     { sequence: "BBBB", period: 1 },

  // ── 2-beat period ──────────────────────────────────────────────────────
  "long-book":     { sequence: "P-P-",   period: 2 },
  "alternating":   { sequence: "RBRB",   period: 2 },

  // ── Solo weave family (8 / 16 / 32-beat) ───────────────────────────────
  "solo-1":        { sequence: "RBBRBRRB",                                 period: 8  },
  "solo-2":        { sequence: "RBBRBRRBBRRBRBBR",                         period: 16 },
  "solo-3":        { sequence: "RBBRBRRBBRRBRBBRBRRBRBBRRBBRBRRB",          period: 32 },

  // ── Dense weave family (8 / 16 / 32-beat) ──────────────────────────────
  "dense-weave-1": { sequence: "RPBPRPBP",                                 period: 8  },
  "dense-weave-2": { sequence: "RPBPRPBPBPRPBPRP",                         period: 16 },
  "dense-weave-3": { sequence: "RPBPRPBPBPRPBPRPBPRPBPRPRPBPRPBP",          period: 32 },

  // ── Sparse weave family (8 / 16 / 32-beat) ─────────────────────────────
  "sparse-weave-1": { sequence: "RBRPBRBP",                                period: 8  },
  "sparse-weave-2": { sequence: "RBRPBRBPBRBPRBRP",                        period: 16 },
  "sparse-weave-3": { sequence: "RBRPBRBPBRBPRBRPBRBPRBRPRBRPBRBP",         period: 32 },
};

// applyReversalToMotion

/**
 * Flips a motion type if the hand is being reversed.
 *
 * Only pro and anti have a rotational direction to invert. Static and dash
 * have no directionality so they pass through unchanged even when the beat
 * is flagged as reversed — the flag is still recorded on the step so
 * downstream consumers can style or annotate the beat appropriately.
 *
 * @param {string} motionType  - 'pro' | 'anti' | 'static' | 'dash'
 * @param {boolean} isReversed - whether this hand should be reversed
 * @returns {string} resulting motion type
 */
function applyReversalToMotion(motionType, isReversed) {
  if (!isReversed) return motionType;

  switch (motionType) {
    case "pro":    return "anti";
    case "anti":   return "pro";
    case "static": return "static"; // no rotation to reverse
    case "dash":   return "dash";   // directionless arc, reversal is a no-op
    default:       return motionType;
  }
}

// getReversalFlagsForBeat

/**
 * Returns which hands are reversed for a given beat index.
 *
 * The pattern string wraps via modulo, so an 8-beat sequence can be applied
 * to a 32-beat sequence — each beat just looks up its slot cyclically.
 *
 * Symbol meanings:
 *   P — both hands reversed (both Pro flip)
 *   R — red hand reversed only
 *   B — blue hand reversed only
 *   - — neither hand reversed (continuous motion)
 *
 * @param {string} patternSequence - sequence string (e.g. 'RBRB')
 * @param {number} beatIndex       - 0-based index into the sequence
 * @returns {{ blueReversal: boolean, redReversal: boolean }}
 * @throws {Error} if the symbol at the resolved index is not P, R, B, or -
 */
function getReversalFlagsForBeat(patternSequence, beatIndex) {
  const symbol = patternSequence[beatIndex % patternSequence.length];

  switch (symbol) {
    case "P": return { blueReversal: true,  redReversal: true  };
    case "R": return { blueReversal: false, redReversal: true  };
    case "B": return { blueReversal: true,  redReversal: false };
    case "-": return { blueReversal: false, redReversal: false };
    default:
      throw new Error(
        `Unknown reversal symbol "${symbol}" at position ${beatIndex % patternSequence.length} ` +
        `in pattern "${patternSequence}". Valid symbols are P, R, B, -.`
      );
  }
}


/**
 * Applies a named reversal pattern to an array of step objects in-place.
 *
 * For each step, this sets blueReversal and redReversal flags based on the
 * pattern symbol for that beat, then flips blueMotionType and/or redMotionType
 * if the corresponding hand is reversed.
 *
 * The mutation is intentional — callers typically build steps, then layer
 * reversal on top, then persist. Returning the same array makes this chainable.
 *
 * @param {Array<{beatIndex: number, blueMotionType: string, redMotionType: string, blueReversal: boolean, redReversal: boolean}>} steps
 * @param {string} patternId - key from REVERSAL_PATTERNS (e.g. 'book', 'alternating')
 * @returns {typeof steps} the mutated steps array
 * @throws {Error} if patternId is not found in REVERSAL_PATTERNS
 */
function applyReversalPattern(steps, patternId) {
  const pattern = REVERSAL_PATTERNS[patternId];
  if (!pattern) {
    throw new Error(
      `Unknown reversal pattern id "${patternId}". ` +
      `Valid ids: ${Object.keys(REVERSAL_PATTERNS).join(", ")}`
    );
  }

  // Reversal is CUMULATIVE (reversal-detector.ts: a beat reverses when its spin
  // differs from the previous beat). A pattern symbol TOGGLES a running per-hand
  // parity; a beat's motion is flipped from base whenever parity is true. The
  // stored reversal flag still marks the toggle beat (the spin-change), which is
  // what the detector re-derives. Absolute per-beat flipping made book/PPPP
  // uniform-anti, which the detector reads back as "continuous".
  let blueParity = false;
  let redParity = false;
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const { blueReversal, redReversal } = getReversalFlagsForBeat(pattern.sequence, i);

    if (blueReversal) blueParity = !blueParity;
    if (redReversal)  redParity  = !redParity;

    step.blueReversal = blueReversal;
    step.redReversal  = redReversal;
    step.blueMotionType = applyReversalToMotion(step.blueMotionType, blueParity);
    step.redMotionType  = applyReversalToMotion(step.redMotionType,  redParity);
  }

  return steps;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  REVERSAL_PATTERNS,
  applyReversalToMotion,
  getReversalFlagsForBeat,
  applyReversalPattern,
};
