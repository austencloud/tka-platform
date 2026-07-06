import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { PropState } from "$lib/shared/foundation/domain/types/prop-state";
import { interpolatePropAngles } from "$lib/shared/animation-engine/services/prop-interpolator";
import { stepToIndexProgress } from "./tunnel-fold-math";

const DEFAULT_PROP_STATE: PropState = { centerPathAngle: 0, staffRotationAngle: 0 };

/**
 * Sample one sequence's blue+red prop states at the shared tunnel playhead.
 * `currentStep` is 1-indexed fractional (the start position is < 1). `ease`
 * optionally reshapes the within-step progress — the live controller passes the
 * global Effort easing so every kaleidoscope copy honors the sidebar's Effort
 * preset in lockstep; the judging gallery passes none (linear).
 *
 * Shared by {@link TunnelViewController} (live kaleidoscope) and the
 * `/test/tunnel-looks` gallery so both derive props identically.
 */
export function sampleTunnelProps(
  seq: SequenceData,
  currentStep: number,
  ease?: (progress: number) => number,
): { blue: PropState; red: PropState } {
  const steps = seq.steps ?? [];
  if (steps.length === 0) {
    return { blue: { ...DEFAULT_PROP_STATE }, red: { ...DEFAULT_PROP_STATE } };
  }
  const { idx, progress } = stepToIndexProgress(currentStep, steps.length);
  const step = steps[idx];
  if (!step) return { blue: { ...DEFAULT_PROP_STATE }, red: { ...DEFAULT_PROP_STATE } };
  const eased = ease ? ease(progress) : progress;
  const r = interpolatePropAngles(step, eased);
  return {
    blue: r.isValid ? (r.blueAngles ?? { ...DEFAULT_PROP_STATE }) : { ...DEFAULT_PROP_STATE },
    red: r.isValid ? (r.redAngles ?? { ...DEFAULT_PROP_STATE }) : { ...DEFAULT_PROP_STATE },
  };
}
