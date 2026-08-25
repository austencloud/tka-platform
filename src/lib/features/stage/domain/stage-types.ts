import type { SceneEnvironmentId } from "$lib/shared/3d/environments/domain/scene-environment";

export interface StageChoreography {
  id: string;
  name: string;
  bpm: number;
  stageWidth: number;
  stageDepth: number;
  environmentId: SceneEnvironmentId;
  performers: Performer[];
  formations: Formation[];
  /** Used when opening older Stage projects that predate performer clip lanes. */
  sharedSequenceId: string | null;
}

export interface Performer {
  id: string;
  index: number;
  label: string;
  color: string;
  sequenceClips: StageSequenceClip[];
}

/**
 * A sequence arranged on one performer's lane. Stage time is expressed in
 * beats, so clips remain musically stable when the project BPM changes.
 */
export interface StageSequenceClip {
  id: string;
  sequenceId: string;
  label: string;
  startBeat: number;
  durationBeats: number;
  sourceBeatCount: number;
  loop: boolean;
}

export interface Formation {
  id: string;
  label?: string;
  atBeat: number;
  transitionBeats: number;
  spots: Record<string, FormationSpot>;
  presetId?: FormationPresetId;
}

export interface FormationSpot {
  x: number;
  z: number;
  facingAngle?: number;
  walkStyle: WalkStyle;
  easing: EasingType;
}

export type WalkStyle = "crab" | "direct";
export type EasingType = "linear" | "easeIn" | "easeOut" | "easeInOut";

export type FormationPresetId =
  | "line"
  | "triangle"
  | "diamond"
  | "circle"
  | "v-shape"
  | "grid"
  | "grid-2x2"
  | "stagger"
  | "cluster"
  | "diagonal"
  | "solo"
  | "tunnel-stack"
  | "back-to-back"
  | "facing-each-other"
  | "stage-lr"
  | "side-by-side"
  | "custom";

export const PERFORMER_LABELS = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
] as const;

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
export const DEFAULT_PERFORMER_COUNT = 4;
