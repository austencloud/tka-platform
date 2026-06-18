import { getContext, setContext } from "svelte";
import type { AnimationScope } from "./animation-scope.svelte";

const ANIMATION_SCOPE_CONTEXT_KEY = Symbol("animation-scope");

/**
 * Scope an AnimationScope to a component subtree. Hosts that drive a per-surface
 * scope (landing demo, embedded previews) call this so descendant consumers read
 * THAT scope's visibility/settings/effects instead of the global singletons -
 * mirroring animation-visibility-context.
 */
export function setAnimationScopeContext(scope: AnimationScope): AnimationScope {
  setContext(ANIMATION_SCOPE_CONTEXT_KEY, scope);
  return scope;
}

/**
 * Returns the subtree-scoped AnimationScope, or null when no ancestor has called
 * setAnimationScopeContext - callers fall through to the global stores.
 */
export function getAnimationScopeContext(): AnimationScope | null {
  return getContext<AnimationScope | null>(ANIMATION_SCOPE_CONTEXT_KEY) ?? null;
}
