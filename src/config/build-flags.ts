/**
 * Runtime readers for the compile-time feature constants.
 *
 * Vite's `define` map replaces `__FEATURE_*__` textually, so a guard written
 * inline against the constant folds away entirely — that is exactly what
 * removes the Coven menu entry (and its `"View in coven hub"` string) from the
 * production client bundle, which `scripts/verify-native-release-surface.mjs`
 * asserts. Inline constants are therefore still correct wherever the goal is to
 * make code VANISH.
 *
 * Route load guards are a different job: they must REDIRECT, and their behavior
 * has to be provable in both states. Vitest loads `vite.config.ts`, so the same
 * define map inlines `__FEATURE_COVEN__` as `true` under `NODE_ENV=test` and
 * the disabled branch becomes unreachable from a test. Reading the constant
 * through this module gives those guards a seam a test can mock, without
 * introducing a second source of truth — the value still comes from the one
 * decision made in `feature-flags.ts`.
 */

/** True when this build ships the unfinished Coven hub route. */
export function isCovenBuildEnabled(): boolean {
  return typeof __FEATURE_COVEN__ !== "undefined" && __FEATURE_COVEN__;
}
