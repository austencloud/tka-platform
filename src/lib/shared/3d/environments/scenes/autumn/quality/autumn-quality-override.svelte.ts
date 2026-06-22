import type { AutumnQualityTier } from "./autumn-quality";

// Dev-only manual override of the auto-detected autumn quality tier. "auto"
// defers to detectAutumnQuality(); any concrete tier forces that tier. Written
// by the right-rail Dev Tools pill group, read by AutumnScene. In-memory only —
// resets to "auto" on reload.
let _tierOverride = $state<AutumnQualityTier | "auto">("auto");

export const autumnQualityOverride = {
  get tier() {
    return _tierOverride;
  },
  set tier(v: AutumnQualityTier | "auto") {
    _tierOverride = v;
  },
};
