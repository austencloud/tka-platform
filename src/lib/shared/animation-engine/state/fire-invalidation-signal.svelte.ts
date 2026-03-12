/**
 * Fire Cache Invalidation Signal
 *
 * A reactive counter that callers increment after operations that desync the
 * fire frame cache (e.g., video export using jumpToStep frame-by-frame).
 * AnimatorCanvas watches this and calls engine.invalidateFireCache() when
 * it changes.
 */

let _signal = $state(0);

export const fireCacheInvalidation = {
  get signal() {
    return _signal;
  },
  /** Increment to tell AnimatorCanvas to invalidate its fire frame cache. */
  trigger() {
    _signal++;
  },
};
