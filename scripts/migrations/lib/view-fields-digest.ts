/**
 * Direct digest of the authored per-motion fields the lean canonical `Motion`
 * drops — the fields at risk in the StepData->Step migration.
 *
 * Why this exists: the other data-parity fingerprints (identity hash, dedup
 * hashes, step signatures) are DOWNSTREAM consumers. They only read
 * handPath/skewSteps/skewDir — pathShape is read by none of them, so a bridge
 * that nulls pathShape sails through every downstream fingerprint (the
 * 2026-07-01 self-audit's hard blind spot). This digest reads the hydrated
 * steps' motions directly, so ANY drop of an authored field is visible even
 * when no downstream hash consumes it yet.
 *
 * Scope: authored data nothing recomputes on render — handPath, skewSteps,
 * skewDir, pathShape, prefloatMotionType, turns, plane. Deliberately excludes
 * viewer-pref/derived fields (propType, isVisible, arrowLocation, gridMode,
 * placements): those are overridden or recalculated by the render pipeline,
 * so guarding them would only produce false drift.
 */
import type { StepData } from "../../../src/lib/shared/foundation/domain/models/step-data";
import type { MotionData } from "../../../src/lib/shared/pictograph/shared/domain/models/motion-data";
import { HandSide } from "../../../src/lib/shared/pictograph/shared/domain/enums/pictograph-enums";

function motionRiskFields(m: MotionData | undefined): Record<string, unknown> | null {
  if (!m) return null;
  return {
    hp: m.handPath ?? null,
    sk: m.skewSteps ?? null,
    sd: m.skewDir ?? null,
    ps: m.pathShape ?? null,
    pm: m.prefloatMotionType ?? null,
    t: m.turns,
    // Absent plane means Plane.WALL (motion-data.ts:74-76) — normalize so the
    // bridge's explicit "wall" write-back doesn't read as drift. A real plane
    // CHANGE (wall -> wheel/floor) still flags.
    pl: m.plane ?? "wall",
  };
}

/** Canonical JSON of every risk field across all steps/hands. Byte-comparable. */
export function viewFieldsDigest(steps: readonly StepData[]): string {
  return JSON.stringify(
    steps.map((s) => ({
      b: motionRiskFields(s.motions[HandSide.LEFT]),
      r: motionRiskFields(s.motions[HandSide.RIGHT]),
    }))
  );
}

export interface RiskFieldCoverage {
  handPath: number;
  skew: number;
  pathShape: number;
  float: number;
  prefloat: number;
}

/**
 * Counts how many motions in the corpus actually CARRY each risk field. A
 * guard is only as good as its corpus — 0 in any column means the net is
 * toothless on that field (the vacuous-proof failure the self-audit caught).
 */
export function riskFieldCoverage(allSteps: readonly StepData[]): RiskFieldCoverage {
  const cov: RiskFieldCoverage = { handPath: 0, skew: 0, pathShape: 0, float: 0, prefloat: 0 };
  for (const s of allSteps) {
    for (const color of [HandSide.LEFT, HandSide.RIGHT]) {
      const m = s.motions[color];
      if (!m) continue;
      if (m.handPath != null) cov.handPath++;
      if (m.skewSteps != null && m.skewSteps > 0) cov.skew++;
      if (m.pathShape != null) cov.pathShape++;
      if (m.turns === "fl") cov.float++;
      if (m.prefloatMotionType != null) cov.prefloat++;
    }
  }
  return cov;
}

export function formatCoverage(cov: RiskFieldCoverage): string {
  return `handPath=${cov.handPath} skew=${cov.skew} pathShape=${cov.pathShape} float=${cov.float} prefloat=${cov.prefloat}`;
}
