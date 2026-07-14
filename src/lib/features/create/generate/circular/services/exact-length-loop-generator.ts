/**
 * Exact-Length LOOP Generator
 *
 * Circular LOOP generation asks the engine for a SEED and lets the extender
 * close it back up to the requested total length once the seed's
 * orientations don't self-close after one pass. Left unchecked, that means
 * a user requesting an 8-beat LOOP can silently get 16 (or 32) beats back —
 * the orientation-cycle extender doubles/quadruples whatever comes out of
 * the builder. This module enforces the requested length by re-rolling seeds
 * until one closes on its own, while still deliberately offering the
 * "open-at-half" species at its honest doubled length some of the time (an
 * orientation-seeded path) rather than pretending it doesn't exist.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { GenerationOptions } from "../../shared/domain/models/generate-models";
import { GenerationMode } from "../../shared/domain/models/generate-models";
import { expanderMultiplier, specHasExpandInversion } from "$lib/shared/create/services/loop-type-utils";

export interface ExactLengthResult {
  sequence: SequenceData;
  /** true when re-rolls were exhausted and we extended past the requested length */
  extendedPastRequest: boolean;
}

export interface ExactLengthDeps {
  generate: (options: GenerationOptions) => Promise<SequenceData>;
  extend: (sequence: SequenceData) => SequenceData; // orientationCycleExtender.extendIfNeeded
  rng?: () => number; // default Math.random
}

export const ORIENTATION_SEED_PROBABILITY = 0.3;
export const MAX_REROLLS = 5;
export const MAX_SEED_ATTEMPTS = 3;

function isOpen(sequence: SequenceData): boolean {
  return (sequence.orientationCycleCount ?? 1) > 1;
}

export async function generateCircularExactLength(
  options: GenerationOptions,
  deps: ExactLengthDeps
): Promise<ExactLengthResult> {
  const rng = deps.rng ?? Math.random;

  // Only circular, non-word generation goes through the re-roll/seed logic.
  // Word mode's "word" IS the pattern - extending it to close the cycle is
  // expected behavior, not a length overshoot.
  if (!(options.mode === GenerationMode.CIRCULAR && !options.word && options.loopType)) {
    const seq = await deps.generate(options);
    if (isOpen(seq)) {
      return { sequence: deps.extend(seq), extendedPastRequest: false };
    }
    return { sequence: seq, extendedPastRequest: false };
  }

  // Orientation-seeded path: deliberately generate a half-length seed and
  // extend it to the full requested length, when the requested length is
  // eligible for exactly that split and probability rolls in favor of it.
  const length = options.length;
  const wire = options.loopSpecWire;
  const multiplier = wire
    ? expanderMultiplier(wire)
    : options.period === "quartered"
      ? 4
      : 2;

  const half = length / 2;
  const eligible =
    length % 2 === 0 &&
    half % multiplier === 0 &&
    half / multiplier >= 1 &&
    !(wire && specHasExpandInversion(wire) && Math.floor(half / multiplier) < 2);

  if (eligible && rng() < ORIENTATION_SEED_PROBABILITY) {
    for (let attempt = 0; attempt < MAX_SEED_ATTEMPTS; attempt++) {
      try {
        const seedResult = await deps.generate({ ...options, length: half });
        if (seedResult.orientationCycleCount === 2) {
          return { sequence: deps.extend(seedResult), extendedPastRequest: false };
        }
        // Not open at exactly the right cycle - discard and try again.
      } catch {
        // Half-length generation can legitimately throw (engine validation
        // on the halved length). Fall through to the normal path below.
        break;
      }
    }
  }

  // Normal path: re-roll at the full requested length until a CLOSED
  // (cycleCount 1) sequence of EXACTLY the requested length comes back.
  //
  // Two ways a roll can miss the length:
  //  - OPEN (cycleCount > 1): orientation hasn't self-closed; the extender
  //    would double/quadruple it PAST the request. Re-roll for a self-closing
  //    seed (the original overshoot guard).
  //  - SHORT: the loop's transform degenerated on this seed into a literal
  //    repeat, so reduceToMinimalLoop collapsed it BELOW the request (e.g.
  //    16→8). It comes back closed-but-short. Re-roll for a seed whose
  //    transform is genuine at the requested length. This is the deck "asked
  //    for 16, got 8" fix — the previous success test only checked cycleCount,
  //    so a collapsed sequence passed straight through as a success.
  let lastOpen: SequenceData | null = null;
  let lastResult: SequenceData | null = null;
  for (let attempt = 0; attempt < MAX_REROLLS; attempt++) {
    const seq = await deps.generate(options);
    lastResult = seq;
    const closed = (seq.orientationCycleCount ?? 1) === 1;
    if (closed && seq.steps.length === length) {
      return { sequence: seq, extendedPastRequest: false };
    }
    if (!closed) lastOpen = seq;
  }

  // Exhausted. Prefer extending an open sequence up to the requested length;
  // otherwise return the best-effort last result. Systematic collapse is
  // prevented upstream by resolveLoopConfig's quartered gating, so reaching the
  // short fallback is a rare residual (e.g. a degenerate 2-beat quartered seed).
  if (lastOpen) return { sequence: deps.extend(lastOpen), extendedPastRequest: true };
  return { sequence: lastResult!, extendedPastRequest: false };
}
