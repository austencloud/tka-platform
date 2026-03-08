/**
 * Effort Quality Domain
 *
 * Laban-inspired movement qualities mapped to animation easing.
 * Each quality transforms interpolation progress (0-1) to produce
 * distinct movement character.
 */

export type EffortQuality =
  | "linear"
  | "sustained"
  | "sudden"
  | "heavy"
  | "light"
  | "bound"
  | "free";

export interface EffortQualityDescriptor {
  readonly id: EffortQuality;
  readonly label: string;
  readonly description: string;
  readonly color: string;
}

export const EFFORT_QUALITIES: readonly EffortQualityDescriptor[] = [
  {
    id: "linear",
    label: "Linear",
    description: "Constant speed. No easing.",
    color: "#94a3b8",
  },
  {
    id: "sustained",
    label: "Sustained",
    description: "Even, flowing. Like tai chi.",
    color: "#22d3ee",
  },
  {
    id: "sudden",
    label: "Sudden",
    description: "Hangs at origin, snaps to target.",
    color: "#f43f5e",
  },
  {
    id: "heavy",
    label: "Heavy",
    description: "Builds momentum, lands with weight.",
    color: "#a855f7",
  },
  {
    id: "light",
    label: "Light",
    description: "Launches fast, floats to rest.",
    color: "#34d399",
  },
  {
    id: "bound",
    label: "Bound",
    description: "Robotic precision. Discrete stops.",
    color: "#fb923c",
  },
  {
    id: "free",
    label: "Free",
    description: "Overshoots target, settles back.",
    color: "#818cf8",
  },
] as const;
