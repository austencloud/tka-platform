import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { SkewDirection } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

/**
 * Per-hand skew data for a single beat.
 *
 * Skews modify how far a shift travels along the ring:
 *   shift+  = 1 step further (skewSteps: 1, skewDir: PLUS)
 *   shift++ = 2 steps further (skewSteps: 2, skewDir: PLUS)
 *   shift-  = 1 step shorter  (skewSteps: 1, skewDir: MINUS)
 */
export interface HandSkew {
  readonly steps: number;
  readonly direction: SkewDirection;
}

/**
 * A hand path trace is the raw spatial data: where each hand is at each point
 * in time. From 9 locations per hand we derive 8 beats (transitions).
 *
 * Skew data is optional per-beat, per-hand. Only shifts can be skewed.
 */
export interface HandPathTrace {
  blue: GridLocation[];
  red: GridLocation[];
  /** Per-beat skew overrides. Index aligns with beat index (0 = first transition). */
  skews?: { blue?: HandSkew; red?: HandSkew }[];
}

export interface IHandPathDataBuilder {
  parseHandPathId(handPathId: string): HandPathTrace;
  buildFromTrace(trace: HandPathTrace): PictographData[];
  buildFromHandPathId(handPathId: string, representative?: SequenceData): PictographData[];
}
