/**
 * Reversal Pattern Matcher
 *
 * Given a sequence's per-beat `blueReversal`/`redReversal` flags, compute
 * a signature string using P/R/B/- symbols, then match it against the
 * known reversal patterns in `reversal-patterns.ts`.
 *
 * Signature symbols (per beat):
 *   P - both hands reversed
 *   R - red reversed, blue continuous
 *   B - blue reversed, red continuous
 *   - - neither reversed
 *
 * A sequence matches a pattern when the pattern's base sequence, repeated
 * modulo its period to the sequence length, equals the observed signature.
 */

import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import {
  REVERSAL_PATTERNS,
  type ReversalPatternDef,
} from "./reversal-patterns";

export type ReversalSymbol = "P" | "R" | "B" | "-";

export function stepToReversalSymbol(step: Pick<StepData, "blueReversal" | "redReversal">): ReversalSymbol {
  const b = step.blueReversal === true;
  const r = step.redReversal === true;
  if (b && r) return "P";
  if (r) return "R";
  if (b) return "B";
  return "-";
}

export function computeReversalSignature(steps: readonly Pick<StepData, "blueReversal" | "redReversal">[]): string {
  return steps.map(stepToReversalSymbol).join("");
}

function signatureMatchesPattern(signature: string, pattern: ReversalPatternDef): boolean {
  const base = pattern.sequence;
  if (signature.length === 0) return false;
  if (signature.length < pattern.minBeats) return false;
  if (signature.length % pattern.period !== 0) return false;

  for (let i = 0; i < signature.length; i++) {
    if (signature[i] !== base[i % base.length]) return false;
  }
  return true;
}

export function findMatchingReversalPattern(
  steps: readonly Pick<StepData, "blueReversal" | "redReversal">[],
): ReversalPatternDef | null {
  const signature = computeReversalSignature(steps);
  if (signature.length === 0) return null;

  for (const pattern of REVERSAL_PATTERNS) {
    if (signatureMatchesPattern(signature, pattern)) {
      return pattern;
    }
  }
  return null;
}

export function matchReversalPatternId(
  steps: readonly Pick<StepData, "blueReversal" | "redReversal">[],
): string | null {
  return findMatchingReversalPattern(steps)?.id ?? null;
}
