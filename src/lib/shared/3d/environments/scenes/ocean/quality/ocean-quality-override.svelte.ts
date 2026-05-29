import type { OceanQualityTier } from "./ocean-quality";

// Dev-only manual override of the auto-detected ocean quality tier. "auto"
// defers to detectOceanQuality(); any concrete tier forces that tier. Written
// by the right-rail Dev Tools pill group, read by OceanScene. In-memory only —
// resets to "auto" on reload.
let _tierOverride = $state<OceanQualityTier | "auto">("auto");

export const oceanQualityOverride = {
  get tier() {
    return _tierOverride;
  },
  set tier(v: OceanQualityTier | "auto") {
    _tierOverride = v;
  },
};
