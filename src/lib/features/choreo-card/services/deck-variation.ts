/**
 * Deck Variation Engine
 *
 * Applies draw-time variations to LOOP deck cards: book-family reversals
 * (prop-spin flips) and low-intensity turns. Both reuse the proven transform
 * code — reversals via `transformSequence` (flip + letter re-derive + reorient),
 * turns via `applyPattern` (turn application + forward orientation propagation).
 *
 * Loop-safety:
 *   - Reversals: only book patterns whose toggle count is even per hand keep the
 *     prop returning to its starting spin (resolvePattern.isCleanLoop). Gated.
 *   - Turns: whether a turn preserves or reverses orientation depends on motion
 *     type AND turn parity (orientation algebra), so closure can't be predicted
 *     by counting alone. We GENERATE-AND-CHECK: apply a candidate, then verify
 *     the loop still closes (last endOrientation === first startOrientation per
 *     hand) using the real orientation chain produced by `applyPattern`.
 */

import {
  SIMPLE_PATTERNS,
  getCompatiblePatterns,
} from "../domain/reversal-patterns";
import { resolvePattern, type ResolvedReversalPattern } from "../domain/reversal-transform";
import { transformSequence } from "./reversal-seed-service";
import type { CsvEdge } from "./pictograph-letter-lookup";
import { applyPattern } from "$lib/shared/create/services/turn-pattern-manager";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import type {
  TurnPattern,
  TurnPatternEntry,
  TurnValue,
} from "$lib/shared/create/domain/TurnPatternData";
import { MotionType } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

export type Rng = () => number;

export interface VariationConfig {
  /** 0..1 — probability a drawn card receives a book reversal. */
  reversalFrequency: number;
  /** Eligible book pattern ids (e.g. "book", "red-book", "alternating"). */
  enabledReversals: string[];
  /** 0..1 — probability a drawn card receives turns. */
  turnFrequency: number;
  /** Turn cap. 1 allows {0.5, 1}; 2 allows up to {2}, still skewed low. */
  maxTurns: number;
  /** 0..1 — per-eligible-hand-beat chance of a nonzero turn. Default 0.4. */
  turnDensity?: number;
}

export interface AppliedVariation {
  reversalPatternId: string | null;
  reversalLabel: string | null;
  reversalSequence: string | null;
  turnEntries: TurnPatternEntry[] | null;
  /** false when turns were requested but no loop-safe pattern was found. */
  turnLoopClosed: boolean;
  warnings: string[];
}

export interface VariantResult {
  /** Transformed sequence (identical to input when no variation applied). */
  sequence: SequenceData;
  variation: AppliedVariation;
}

export const DEFAULT_VARIATION_CONFIG: VariationConfig = {
  reversalFrequency: 0.4,
  enabledReversals: ["book", "red-book", "blue-book", "alternating", "long-book"],
  turnFrequency: 0.4,
  maxTurns: 1,
  turnDensity: 0.4,
};

/** Book patterns offered to the UI (the `simple`, non-continuous family). */
export const BOOK_PATTERNS = SIMPLE_PATTERNS.filter((p) => p.id !== "continuous");

/** Convert a raw pattern string ("RRRR") into per-beat reversal flags, tiled to N. */
function tileFlags(sequence: string, stepCount: number): { blue: boolean[]; red: boolean[] } {
  const blue: boolean[] = [];
  const red: boolean[] = [];
  for (let i = 0; i < stepCount; i++) {
    const sym = sequence[i % sequence.length];
    blue.push(sym === "P" || sym === "B");
    red.push(sym === "P" || sym === "R");
  }
  return { blue, red };
}

/** Pick a random compatible + clean-loop book pattern from the enabled set. */
function pickReversal(
  stepCount: number,
  enabled: string[],
  rng: Rng,
): ResolvedReversalPattern | null {
  const candidates = getCompatiblePatterns(stepCount)
    .filter((p) => p.family === "simple" && p.id !== "continuous" && enabled.includes(p.id))
    .map((def) => {
      const { blue, red } = tileFlags(def.sequence, stepCount);
      return resolvePattern(blue, red);
    })
    .filter((r) => r.isCleanLoop);
  if (candidates.length === 0) return null;
  return candidates[Math.floor(rng() * candidates.length)] ?? null;
}

/** Turn values to draw from, skewed toward the smallest increments. */
function turnPool(maxTurns: number): number[] {
  if (maxTurns <= 1) return [0.5, 0.5, 0.5, 1];
  return [0.5, 0.5, 0.5, 0.5, 1, 1, 1.5, 2];
}

function isRotational(motion: MotionData | undefined): boolean {
  return !!motion && (motion.motionType === MotionType.PRO || motion.motionType === MotionType.ANTI);
}

/** Does the loop close on each hand? (last endOrientation === first startOrientation) */
function loopCloses(seq: SequenceData): { blue: boolean; red: boolean } {
  const steps = seq.steps;
  const first = steps[0];
  const last = steps[steps.length - 1];
  function handCloses(hand: "blue" | "red"): boolean {
    const fm = first?.motions?.[hand];
    const lm = last?.motions?.[hand];
    if (!fm || !lm) return true;
    return lm.endOrientation === fm.startOrientation;
  }
  return { blue: handCloses("blue"), red: handCloses("red") };
}

const MAX_TURN_ATTEMPTS = 32;

/**
 * Generate a loop-safe turn pattern for `seq` and return the turned sequence.
 * Returns null if no closing candidate was found within the attempt budget.
 */
function generateLoopSafeTurns(
  seq: SequenceData,
  maxTurns: number,
  density: number,
  rng: Rng,
): { sequence: SequenceData; entries: TurnPatternEntry[]; warnings: string[] } | null {
  const steps = seq.steps as readonly StepData[];
  const n = steps.length;
  const base = loopCloses(seq);
  const pool = turnPool(maxTurns);

  for (let attempt = 0; attempt < MAX_TURN_ATTEMPTS; attempt++) {
    const entries: TurnPatternEntry[] = [];
    let any = false;
    for (let i = 0; i < n; i++) {
      const motions = steps[i]?.motions;
      let blue: TurnValue | null = null;
      let red: TurnValue | null = null;
      if (isRotational(motions?.blue) && rng() < density) {
        blue = pool[Math.floor(rng() * pool.length)] ?? null;
        if (blue) any = true;
      }
      if (isRotational(motions?.red) && rng() < density) {
        red = pool[Math.floor(rng() * pool.length)] ?? null;
        if (red) any = true;
      }
      entries.push({ stepIndex: i, blue, red });
    }
    if (!any) continue;

    const pattern: TurnPattern = {
      id: "variation",
      name: "variation",
      userId: "",
      createdAt: null as unknown as TurnPattern["createdAt"],
      stepCount: n,
      entries,
    };
    const res = applyPattern(pattern, seq, "both");
    if (!res.success || !res.sequence) continue;

    const closed = loopCloses(res.sequence);
    const ok = (closed.blue || !base.blue) && (closed.red || !base.red);
    if (ok) {
      return { sequence: res.sequence, entries, warnings: [...(res.warnings ?? [])] };
    }
  }
  return null;
}

/**
 * Roll and apply variations to a single drawn sequence. Pure given `rng`.
 */
export function applyVariation(
  seq: SequenceData,
  config: VariationConfig,
  edges: CsvEdge[],
  rng: Rng = Math.random,
): VariantResult {
  const stepCount = seq.steps.length;
  const warnings: string[] = [];
  let working = seq;

  let reversalPatternId: string | null = null;
  let reversalLabel: string | null = null;
  let reversalSequence: string | null = null;

  if (config.enabledReversals.length > 0 && rng() < config.reversalFrequency) {
    const resolved = pickReversal(stepCount, config.enabledReversals, rng);
    if (resolved) {
      working = transformSequence(working, resolved, edges);
      reversalPatternId = resolved.id;
      reversalLabel = resolved.label;
      reversalSequence = resolved.sequence;
    }
  }

  let turnEntries: TurnPatternEntry[] | null = null;
  let turnLoopClosed = true;

  if (rng() < config.turnFrequency) {
    const gen = generateLoopSafeTurns(working, config.maxTurns, config.turnDensity ?? 0.4, rng);
    if (gen) {
      working = gen.sequence;
      turnEntries = gen.entries;
      warnings.push(...gen.warnings);
    } else {
      turnLoopClosed = false;
      warnings.push("No loop-safe turn pattern found in budget; turns left off.");
    }
  }

  return {
    sequence: working,
    variation: {
      reversalPatternId,
      reversalLabel,
      reversalSequence,
      turnEntries,
      turnLoopClosed,
      warnings,
    },
  };
}
