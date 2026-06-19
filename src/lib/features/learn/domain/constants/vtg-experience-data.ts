/**
 * VTG (Velocity-Timing-Direction) concept experience data
 */

// Canonical source for VTGMode. Re-exported so existing importers (incl. the
// vtg-lab domain) keep resolving it from here.
export { type VTGMode } from "./shared-types";
import type { VTGMode } from "./shared-types";

export interface VTGModeInfo {
  name: string;
  color: string;
  icon: string;
  directionLabel: string;
  timingLabel: string;
  description: string;
  keyPoint: string;
}

export const VTG_MODES: VTGMode[] = ["SS", "TS", "SO", "TO", "QS", "QO"];

export const VTG_MODE_INFO: Record<VTGMode, VTGModeInfo> = {
  SS: {
    name: "Split-Same",
    color: "#22D3EE",
    icon: "fa-arrows-left-right",
    directionLabel: "Same (both hands arc the same way)",
    timingLabel: "Split (180° out of phase)",
    description: "Both hands arc the same way, held 180° out of phase",
    keyPoint: "Hands stay at opposite points (alpha) the whole cycle",
  },
  TS: {
    name: "Together-Same",
    color: "#4ADE80",
    icon: "fa-arrows-up-down",
    directionLabel: "Same (both hands arc the same way)",
    timingLabel: "Together (in sync at the downbeat)",
    description: "Both hands arc the same way, in sync",
    keyPoint: "Hands stay at the same point (beta) the whole cycle",
  },
  SO: {
    name: "Split-Opposite",
    color: "#F472B6",
    icon: "fa-clock",
    directionLabel: "Opposite (hands arc opposite ways)",
    timingLabel: "Split (180° apart at the downbeat)",
    description: "Hands arc opposite ways, sweeping through together and apart; 180° apart at the downbeat",
    keyPoint: "Counter-arcing hands pass through together and apart each cycle",
  },
  TO: {
    name: "Together-Opposite",
    color: "#FB923C",
    icon: "fa-rotate",
    directionLabel: "Opposite (hands arc opposite ways)",
    timingLabel: "Together (in sync at the downbeat)",
    description: "Hands arc opposite ways, sweeping through apart and back; together at the downbeat",
    keyPoint: "Counter-arcing hands meet at the downbeat each cycle",
  },
  QS: {
    name: "Quarter-Same",
    color: "#A78BFA",
    icon: "fa-circle-quarter-stroke",
    directionLabel: "Same (both hands arc the same way)",
    timingLabel: "Quarter (90° out of phase)",
    description: "Both hands arc the same way, held 90° out of phase",
    keyPoint: "Hands stay a quarter-cycle (gamma) apart the whole cycle",
  },
  QO: {
    name: "Quarter-Opposite",
    color: "#F59E0B",
    icon: "fa-wave-square",
    directionLabel: "Opposite (hands arc opposite ways)",
    timingLabel: "Quarter (90° apart at the downbeat)",
    description: "Hands arc opposite ways, sweeping through together and apart; 90° apart at the downbeat",
    keyPoint: "Counter-arcing hands, offset a quarter-cycle at the downbeat",
  },
};
