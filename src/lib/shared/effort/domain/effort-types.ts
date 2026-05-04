/**
 * Unified Effort Type System
 *
 * 8 effort qualities: 4 from Laban's action drive (Weight x Time),
 * 3 animation-inspired easings, and 1 baseline reference (Linear).
 */

export type EffortId =
  | "linear"
  | "glide"
  | "dab"
  | "press"
  | "punch"
  | "elastic"
  | "bounce"
  | "anticipation";

export interface EffortParamDef {
  readonly key: string;
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly defaultValue: number;
}

export interface EffortDescriptor {
  readonly id: EffortId;
  readonly label: string;
  readonly subtitle: string;
  readonly color: string;
  readonly params: readonly EffortParamDef[];
}

export type EffortParams = Record<string, number>;

export const EFFORTS: readonly EffortDescriptor[] = [
  {
    id: "linear",
    label: "Linear",
    subtitle: "constant speed",
    color: "#94a3b8",
    params: [],
  },
  {
    id: "glide",
    label: "Glide",
    subtitle: "light, sustained",
    color: "#34d399",
    params: [
      { key: "weight", label: "Weight", min: 0, max: 1, step: 0.05, defaultValue: 0.2 },
      { key: "time", label: "Time", min: 0, max: 1, step: 0.05, defaultValue: 0.2 },
    ],
  },
  {
    id: "dab",
    label: "Dab",
    subtitle: "light, sudden",
    color: "#22d3ee",
    params: [
      { key: "weight", label: "Weight", min: 0, max: 1, step: 0.05, defaultValue: 0.2 },
      { key: "time", label: "Time", min: 0, max: 1, step: 0.05, defaultValue: 0.8 },
    ],
  },
  {
    id: "press",
    label: "Press",
    subtitle: "strong, sustained",
    color: "#a855f7",
    params: [
      { key: "weight", label: "Weight", min: 0, max: 1, step: 0.05, defaultValue: 0.8 },
      { key: "time", label: "Time", min: 0, max: 1, step: 0.05, defaultValue: 0.2 },
    ],
  },
  {
    id: "punch",
    label: "Punch",
    subtitle: "strong, sudden",
    color: "#f43f5e",
    params: [
      { key: "weight", label: "Weight", min: 0, max: 1, step: 0.05, defaultValue: 0.8 },
      { key: "time", label: "Time", min: 0, max: 1, step: 0.05, defaultValue: 0.8 },
    ],
  },
  {
    id: "elastic",
    label: "Elastic",
    subtitle: "overshoot, rebound",
    color: "#f59e0b",
    params: [
      { key: "amplitude", label: "Amplitude", min: 0.1, max: 1.5, step: 0.05, defaultValue: 0.4 },
      { key: "frequency", label: "Frequency", min: 0.5, max: 3, step: 0.25, defaultValue: 1.0 },
    ],
  },
  {
    id: "bounce",
    label: "Bounce",
    subtitle: "percussive rebounds",
    color: "#ec4899",
    params: [],
  },
  {
    id: "anticipation",
    label: "Anticipation",
    subtitle: "wind-up, release",
    color: "#6366f1",
    params: [
      { key: "pullback", label: "Pullback", min: 0.1, max: 0.5, step: 0.05, defaultValue: 0.3 },
    ],
  },
] as const;
