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
 * `offset` (steps) and `speed` (rate) are the per-copy Stagger + Speed
 * modulators: the effective beat is `(beat × speed) + offset`, wrapped into the
 * sequence so a staggered/faster arm shows a different moment. Defaults (0, 1)
 * leave the playhead untouched — identical to a plain sample.
 *
 * Shared by {@link TunnelViewController} (live kaleidoscope) and the
 * `/test/tunnel-looks` gallery so both derive props identically.
 */
export function sampleTunnelProps(
  seq: SequenceData,
  currentStep: number,
  ease?: (progress: number) => number,
  offset = 0,
  speed = 1,
): { blue: PropState; red: PropState } {
  const steps = seq.steps ?? [];
  const length = steps.length;
  if (length === 0) {
    return { blue: { ...DEFAULT_PROP_STATE }, red: { ...DEFAULT_PROP_STATE } };
  }
  let effStep = currentStep;
  if (speed !== 1 || offset !== 0) {
    // Modulate in the step domain (0-indexed beat), then wrap so the arm loops
    // rather than clamping at the end.
    let beat = (currentStep - 1) * speed + offset;
    beat = ((beat % length) + length) % length;
    effStep = beat + 1;
  } else if (currentStep - 1 >= length) {
    // Base arm (1×) riding the live tunnel's UNBOUNDED playhead: the shared clock
    // no longer resets each base loop (so per-Speed arms can drift), so wrap whole
    // cycles here to keep the base looping. Sub-1 currentStep (the start position)
    // is left untouched — the plain sample must not wrap the start to the end.
    effStep = ((currentStep - 1) % length) + 1;
  }
  const { idx, progress } = stepToIndexProgress(effStep, length);
  const step = steps[idx];
  if (!step) return { blue: { ...DEFAULT_PROP_STATE }, red: { ...DEFAULT_PROP_STATE } };
  const eased = ease ? ease(progress) : progress;
  const r = interpolatePropAngles(step, eased);
  return {
    blue: r.isValid ? (r.blueAngles ?? { ...DEFAULT_PROP_STATE }) : { ...DEFAULT_PROP_STATE },
    red: r.isValid ? (r.redAngles ?? { ...DEFAULT_PROP_STATE }) : { ...DEFAULT_PROP_STATE },
  };
}
