/**
 * Turn Parity Constraint (Phase 4, scoped skeleton)
 *
 * Enforces that per-pass per-hand turn totals satisfy the parity required
 * for orientation closure at the target period.
 *
 * ## Math
 *
 * Every beat contributes an integer or half-integer number of turns to each
 * hand's orientation budget:
 *   turns ∈ {0, 0.5, 1, 1.5, 2, 2.5, 3}
 *
 * One turn = 180° = 2 quarter-turns. So:
 *   beat quarter-turn delta = 2 · turns (mod 4)
 *
 * Per-pass blue/red orientation delta = sum of all beats' quarter-turn
 * deltas for that hand, mod 4.
 *
 * For closure at period N, we need per-pass delta · N ≡ 0 (mod 4):
 *   N=2: per-pass delta must be even (0 or 2), i.e., turn total must be integer
 *   N=4: per-pass delta can be anything (1, 2, or 3 all close after 4 passes)
 *   N=1: per-pass delta must be 0
 *
 * ## Status
 *
 * Instantiable but not yet wired into beam search. Beam search currently
 * produces sequences without orientation-closure pruning; post-hoc extension
 * guarantees closure via OrientationCycleExtender (Phase 7 task).
 */

import type {
  IConstraint,
  ConstraintContext,
  ConstraintScore,
  ISequenceConstraint,
  PictographData,
} from "../types.js";
import { ConstraintType } from "../constraint-types.js";

export class TurnParityConstraint implements IConstraint, ISequenceConstraint {
  readonly type = ConstraintType.TURN_PARITY;
  readonly mode = "hard" as const;
  readonly description: string;

  /**
   * @param period - Target LOOP period (2, 4, or 8)
   */
  constructor(private readonly period: number) {
    this.description = `Per-pass turn totals close orientation at period ${period}`;
  }

  /**
   * Short-circuit per-variation evaluation. Turn parity is a whole-sequence
   * property — a single beat can't satisfy or violate it in isolation.
   * Always returns satisfied=true at the variation level; the sequence-level
   * check does the real work.
   */
  evaluate(_context: ConstraintContext): ConstraintScore {
    return { score: 1, satisfied: true, reason: "sequence-level check" };
  }

  evaluateSequence(steps: PictographData[]): ConstraintScore {
    const { blueQuarters, redQuarters } = totalQuarterTurns(steps);
    const blueDelta = mod4(blueQuarters);
    const redDelta = mod4(redQuarters);

    const blueCloses = (this.period * blueDelta) % 4 === 0;
    const redCloses = (this.period * redDelta) % 4 === 0;

    if (blueCloses && redCloses) {
      return {
        score: 1,
        satisfied: true,
        reason: `turn parity closes at period ${this.period}`,
      };
    }
    return {
      score: 0,
      satisfied: false,
      reason:
        `per-pass delta (blue=${blueDelta}q, red=${redDelta}q) does not ` +
        `close at period ${this.period}`,
    };
  }
}

function totalQuarterTurns(steps: PictographData[]): {
  blueQuarters: number;
  redQuarters: number;
} {
  let blueQuarters = 0;
  let redQuarters = 0;
  for (const step of steps) {
    const blueT = Number(step.blueMotion.turns ?? 0);
    const redT = Number(step.redMotion.turns ?? 0);
    blueQuarters += Math.round(blueT * 2);
    redQuarters += Math.round(redT * 2);
  }
  return { blueQuarters, redQuarters };
}

function mod4(n: number): number {
  return ((n % 4) + 4) % 4;
}
