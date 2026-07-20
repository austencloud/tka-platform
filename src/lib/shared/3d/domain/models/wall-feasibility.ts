/**
 * Wall-plane feasibility verdict, written offline by the feasibility
 * scanner (scripts/scan-wall-feasibility.ts) into sequence metadata.
 * The viewer reads it to choose plane mode and path params. Absent =
 * unscanned: current behavior, no claims.
 */
export type WallFeasibilityVerdict = true | "withCheat" | false;

/** Per-step, per-hand path overrides. Phase 2 writes k; Phase 3 adds depthOffset. */
export interface WallPlaneStepOverride {
  /** Concavity depth 0..1 for this step's concave path. */
  k?: number;
  /** Phase 3: per-hand z-offset toward (−) / away from (+) the body, meters. */
  depthOffset?: number;
}

export interface WallFeasibilityMetadata {
  wallFeasible: WallFeasibilityVerdict;
  /** Keyed by step index, then hand. Only present for "withCheat". */
  wallPlaneOverrides?: Record<
    number,
    { blue?: WallPlaneStepOverride; red?: WallPlaneStepOverride }
  >;
  /** Scanner version for invalidation when thresholds/model change. */
  scanVersion: number;
}
