import type { EffortId } from "$lib/shared/effort/domain/effort-types";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import type { Plane, PlaneMode } from "@austencloud/scene-3d";

export type EffectId =
  | "trails"
  | "fire"
  | "charcoal"
  | "led"
  | "electricity"
  | "sparkles"
  | "motion"
  | "bloom";

export interface DefaultPerformerSettings {
  prop: PropType;
  effects: Set<EffectId>;
  effortId: EffortId;
  planeMode: PlaneMode;
  customBluePlane: Plane;
  customRedPlane: Plane;
}

export interface PerformerSettings {
  effortId: EffortId | null;
  prop: PropType | null;
  effects: Set<EffectId> | null;
  staffLengthCm: number | null;
}

export type CascadeCategory = "prop" | "effects" | "effort" | "planes";

export interface OverrideState {
  prop: boolean;
  effects: boolean;
  effort: boolean;
  planes: boolean;
}

export function makeDefaultPerformerSettings(): PerformerSettings {
  return {
    effortId: null,
    prop: null,
    effects: null,
    staffLengthCm: null,
  };
}
