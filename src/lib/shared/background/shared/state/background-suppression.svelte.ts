/**
 * BackgroundSuppression
 * Domain: Global animated-background lifecycle gating
 *
 * Responsibilities:
 * - Track which fullscreen-opaque scenes are occluding the global BackgroundHost
 * - Expose whether the background controller should be paused (any active suppressor)
 *
 * Why this exists: the @austencloud/backgrounds controller runs a persistent rAF
 * even when its canvas is fully covered. A fullscreen scene (e.g. the museum) draws
 * an opaque WebGL canvas on top, but the ocean background keeps animating underneath
 * — a perf trace of the museum 2D->3D flip showed updateTentaclePhysics burning ~40%
 * of the main thread while completely invisible, stalling the transition.
 *
 * A fullscreen-opaque scene calls suppressBackground(key) on mount and
 * releaseBackground(key) on destroy. BackgroundHost watches isBackgroundSuppressed
 * and unmounts the controller (stopping its rAF) while any suppressor is active.
 */

import { untrack } from "svelte";

// Active suppressor keys. Keyed (not a bare count) so a scene can register/release
// idempotently without double-suppress/double-release races between mounts.
const state = $state({ keys: [] as string[] });

// The mutators read state.keys (the .includes idempotency check) and write it.
// untrack() wraps that read so a caller inside a reactive $effect does NOT pick up
// state.keys as a dependency — otherwise an effect that calls suppressBackground
// both subscribes to and mutates the same state and self-invalidates forever
// (effect_update_depth_exceeded — hit by MarketingChrome's /shop suppress effect).
// The write still notifies real subscribers like BackgroundHost.isBackgroundSuppressed.

/** Register a suppressor. Idempotent for the same key. Safe to call from a $effect. */
export function suppressBackground(key: string) {
  untrack(() => {
    if (!state.keys.includes(key)) {
      state.keys = [...state.keys, key];
    }
  });
}

/** Release a suppressor. Idempotent — releasing an unknown key is a no-op. */
export function releaseBackground(key: string) {
  untrack(() => {
    if (state.keys.includes(key)) {
      state.keys = state.keys.filter((k) => k !== key);
    }
  });
}

/** True when any fullscreen-opaque scene is currently occluding the background. */
export const isBackgroundSuppressed = {
  get current() {
    return state.keys.length > 0;
  },
};
