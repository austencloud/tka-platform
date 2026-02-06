/**
 * VTG (Velocity-Timing-Direction) concept experience data
 */

export type VTGMode = "SS" | "TS" | "SO" | "TO" | "QS" | "QO";

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
    directionLabel: "Split (opposite)",
    timingLabel: "Same (together)",
    description: "Hands move in opposite directions at the same time",
    keyPoint: "Like opening a book - hands move apart simultaneously",
  },
  TS: {
    name: "Together-Same",
    color: "#4ADE80",
    icon: "fa-arrows-up-down",
    directionLabel: "Together (parallel)",
    timingLabel: "Same (together)",
    description: "Hands move in the same direction at the same time",
    keyPoint: "Like pushing forward - both hands move as one",
  },
  SO: {
    name: "Same-Opposite",
    color: "#F472B6",
    icon: "fa-clock",
    directionLabel: "Same direction",
    timingLabel: "Opposite (staggered)",
    description: "Same direction movement with staggered timing",
    keyPoint: "One hand leads, the other follows half-beat later",
  },
  TO: {
    name: "Together-Opposite",
    color: "#FB923C",
    icon: "fa-rotate",
    directionLabel: "Together (parallel)",
    timingLabel: "Opposite (alternating)",
    description: "Parallel paths but alternating start times",
    keyPoint: "Like walking - arms swing in alternating rhythm",
  },
  QS: {
    name: "Quarter-Same",
    color: "#A78BFA",
    icon: "fa-circle-quarter-stroke",
    directionLabel: "Same direction",
    timingLabel: "Quarter (90° offset)",
    description: "Same direction with quarter-beat timing offset",
    keyPoint: "One hand is always 90° ahead in the cycle",
  },
  QO: {
    name: "Quarter-Opposite",
    color: "#F59E0B",
    icon: "fa-wave-square",
    directionLabel: "Opposite directions",
    timingLabel: "Quarter (90° offset)",
    description: "Opposite directions with quarter-beat offset",
    keyPoint: "Complex cross-pattern with 90° phase difference",
  },
};
