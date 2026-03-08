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

export interface EffortParamDef {
  readonly key: string;
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly defaultValue: number;
}

export interface EffortQualityDescriptor {
  readonly id: EffortQuality;
  readonly label: string;
  readonly description: string;
  readonly color: string;
  readonly params: readonly EffortParamDef[];
}

export const EFFORT_QUALITIES: readonly EffortQualityDescriptor[] = [
  {
    id: "linear",
    label: "Linear",
    description: "Constant speed. No easing.",
    color: "#94a3b8",
    params: [],
  },
  {
    id: "sustained",
    label: "Sustained",
    description: "Even, flowing. Like tai chi.",
    color: "#22d3ee",
    params: [
      {
        key: "intensity",
        label: "Intensity",
        min: 0.5,
        max: 3.0,
        step: 0.1,
        defaultValue: 1.0,
      },
    ],
  },
  {
    id: "sudden",
    label: "Sudden",
    description: "Hangs at origin, snaps to target.",
    color: "#f43f5e",
    params: [
      {
        key: "sharpness",
        label: "Sharpness",
        min: 2,
        max: 8,
        step: 0.5,
        defaultValue: 5,
      },
    ],
  },
  {
    id: "heavy",
    label: "Heavy",
    description: "Builds momentum, lands with weight.",
    color: "#a855f7",
    params: [
      {
        key: "weight",
        label: "Weight",
        min: 0.3,
        max: 0.9,
        step: 0.05,
        defaultValue: 0.7,
      },
    ],
  },
  {
    id: "light",
    label: "Light",
    description: "Launches fast, floats to rest.",
    color: "#34d399",
    params: [
      {
        key: "softness",
        label: "Softness",
        min: 2,
        max: 6,
        step: 0.5,
        defaultValue: 4,
      },
    ],
  },
  {
    id: "bound",
    label: "Bound",
    description: "Controlled isolation. Decisive arrivals.",
    color: "#fb923c",
    params: [
      {
        key: "steps",
        label: "Steps",
        min: 2,
        max: 8,
        step: 1,
        defaultValue: 4,
      },
      {
        key: "smoothness",
        label: "Smoothness",
        min: 0,
        max: 1,
        step: 0.1,
        defaultValue: 0.5,
      },
    ],
  },
  {
    id: "free",
    label: "Free",
    description: "Organic momentum with flowing follow-through.",
    color: "#818cf8",
    params: [
      {
        key: "momentum",
        label: "Momentum",
        min: 0.1,
        max: 1.0,
        step: 0.1,
        defaultValue: 0.5,
      },
    ],
  },
] as const;
