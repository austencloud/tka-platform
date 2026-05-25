import type { Plane } from "@austencloud/scene-3d";

export interface StageChoreography {
  id: string;
  name: string;
  bpm: number;
  stageWidth: number;
  stageDepth: number;
  performers: PerformerSlot[];
  formations: FormationKeyframe[];
}

export interface PerformerSlot {
  id: string;
  index: number;
  color: string;
}

export interface FormationKeyframe {
  id: string;
  beat: number;
  positions: PerformerPose[];
  transition?: TransitionConfig;
}

export interface PerformerPose {
  performerId: string;
  x: number;
  z: number;
  facing: number;
  planeMode?: Plane;
}

export interface TransitionConfig {
  interpolation: "linear" | "ease" | "spline" | "arc";
  easing: "linear" | "easeInOut" | "easeIn" | "easeOut";
}

export type FormationPresetId =
  | "line"
  | "triangle"
  | "diamond"
  | "circle"
  | "v-shape"
  | "grid"
  | "stagger"
  | "cluster";

export const PERFORMER_COLORS = [
  "#ff6b6b",
  "#4ecdc4",
  "#ffe66d",
  "#a06cd5",
  "#ff9a76",
  "#6bcf7f",
  "#7eb8da",
  "#e87ea1",
] as const;

export const DEFAULT_STAGE_WIDTH = 10;
export const DEFAULT_STAGE_DEPTH = 8;
export const DEFAULT_BPM = 120;
