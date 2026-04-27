/**
 * Fire Cache Invalidation Signal
 *
 * A reactive counter that callers increment after operations that desync the
 * fire frame cache (e.g., video export using jumpToStep frame-by-frame).
 * AnimatorCanvas watches this and calls engine.invalidateFireCache() when
 * it changes.
 *
 * Two modes:
 * - trigger(): full clear (simulation FBOs + frame cache) — use after export
 * - triggerCacheOnly(): invalidate frame cache only, keep warm simulation — use before export
 */

let _signal = $state(0);
let _cacheOnly = $state(false);

export const fireCacheInvalidation = {
  get signal() {
    return _signal;
  },
  get cacheOnly() {
    return _cacheOnly;
  },
  /** Full invalidation: clear simulation FBOs + frame cache. */
  trigger() {
    _cacheOnly = false;
    _signal++;
  },
  /** Cache-only invalidation: keep warm simulation, just drop cached frames. */
  triggerCacheOnly() {
    _cacheOnly = true;
    _signal++;
  },
};
