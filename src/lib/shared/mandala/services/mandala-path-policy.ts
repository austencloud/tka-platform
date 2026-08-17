import type { AnimationPathPolicy } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
import type { MandalaPathShape } from "../domain/mandala-types";

/**
 * The canvas states its motion-path choice as a shape plus a By Motion flag;
 * a mandala states the same choice as one shape name, where "hybrid" IS By
 * Motion. One conversion, used by every surface that draws a mandala beside
 * an animation, so the card's paths cannot say concave while the props swing
 * on arcs.
 */
export function toMandalaPathShape(policy: AnimationPathPolicy): MandalaPathShape {
  return policy.motionAwarePaths ? "hybrid" : policy.pathShape;
}
