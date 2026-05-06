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
let _mode = $state<"full" | "cacheOnly" | "thermalClear">("full");

export const fireCacheInvalidation = {
  get signal() {
    return _signal;
  },
  get cacheOnly() {
    return _mode === "cacheOnly";
  },
  get mode() {
    return _mode;
  },
  /** Full invalidation: clear simulation FBOs + frame cache. */
  trigger() {
    _mode = "full";
    _signal++;
  },
  /** Cache-only invalidation: keep warm simulation, just drop cached frames. */
  triggerCacheOnly() {
    _mode = "cacheOnly";
    _signal++;
  },
  /** Clear thermal fields (temp/fuel/velocity/color) but keep pressure. */
  triggerThermalClear() {
    _mode = "thermalClear";
    _signal++;
  },
};
