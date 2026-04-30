/**
 * Thrown when a (loopType, period, level, gridMode) combination is not
 * generatable. The LOOP algebra forbids period 4 on non-rotated primitives
 * (each is order 2 in the transformation group, and turns don't compose
 * with LOOP structure - see docs/superpowers/specs/2026-04-19-loop-period-viability-design.md §4.2).
 */
export class LoopViabilityError extends Error {
  readonly suggestion?: string;

  constructor(reason: string, suggestion?: string) {
    super(suggestion ? `${reason} ${suggestion}` : reason);
    this.name = "LoopViabilityError";
    this.suggestion = suggestion;
    Object.setPrototypeOf(this, LoopViabilityError.prototype);
  }
}
