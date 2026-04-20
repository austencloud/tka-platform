import type { LOOPType } from "../../../circular/domain/models/circular-models";
import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

/**
 * Result of a LOOP viability check. When !viable, `reason` is a human-readable
 * sentence explaining the block; `suggestion` (if present) is an actionable
 * follow-up the UI can show to the user.
 */
export interface LoopViabilityCheck {
  readonly viable: boolean;
  readonly reason?: string;
  readonly suggestion?: string;
}

export interface LoopViabilityArgs {
  readonly loopType: LOOPType;
  readonly period: number;
  readonly level?: number;
  readonly gridMode?: GridMode;
}

/**
 * Authoritative answer for "is this (loopType, period, level, gridMode)
 * combination generatable?"
 *
 * Rule (from docs/superpowers/specs/2026-04-19-loop-period-viability-design.md):
 *   - Period 2 is always viable for every LOOP type.
 *   - Period 4 is viable iff the LOOP type contains ROTATED.
 *   - Period 8 is reserved for L7+ (always infeasible today).
 *   - Any other period is rejected.
 */
export interface ILoopViabilityService {
  check(args: LoopViabilityArgs): LoopViabilityCheck;
}
