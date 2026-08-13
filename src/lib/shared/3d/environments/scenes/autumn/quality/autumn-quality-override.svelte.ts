import type { AutumnQualityTier } from "./autumn-quality";

// Dev-only manual override of the shared adaptive quality tier. "auto" follows
// the renderer capability and live frame-pressure owner; any concrete tier
// forces that tier. Written by the right-rail Dev Tools pill group, read by
// AutumnScene. In-memory only, so it resets to "auto" on reload.
let _tierOverride = $state<AutumnQualityTier | "auto">("auto");

export const autumnQualityOverride = {
  get tier() {
    return _tierOverride;
  },
  set tier(v: AutumnQualityTier | "auto") {
    _tierOverride = v;
  },
};
