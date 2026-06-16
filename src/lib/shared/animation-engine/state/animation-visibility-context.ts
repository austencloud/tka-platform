import { getContext, setContext } from "svelte";
import type { AnimationVisibilityStateManager } from "./animation-visibility-state.svelte";

const ANIMATION_VISIBILITY_CONTEXT_KEY = Symbol("animation-visibility-manager");

/**
 * Scope an AnimationVisibilityStateManager to a component subtree.
 *
 * Hosts that drive an ephemeral per-canvas manager (landing demo, embedded
 * previews) call this so the settings panels (Effort/Display/PathShape) and
 * AnimationPanel write to THAT instance instead of the global singleton -
 * mirroring the effects-config-context pattern.
 */
export function setAnimationVisibilityContext(
  manager: AnimationVisibilityStateManager,
): AnimationVisibilityStateManager {
  setContext(ANIMATION_VISIBILITY_CONTEXT_KEY, manager);
  return manager;
}

/**
 * Returns the subtree-scoped visibility manager, or null when no ancestor has
 * called setAnimationVisibilityContext - callers fall through to
 * getAnimationVisibilityManager() (the global singleton).
 */
export function getAnimationVisibilityContext(): AnimationVisibilityStateManager | null {
  return getContext<AnimationVisibilityStateManager | null>(ANIMATION_VISIBILITY_CONTEXT_KEY) ?? null;
}
