import type { EffortId } from "$lib/shared/effort/domain/effort-types";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import { Plane, PlaneMode } from "@austencloud/scene-3d";
import type { EffectType } from "$lib/shared/effects/domain/effects-config";

export interface DefaultPerformerSettings {
  prop: PropType;
  effortId: EffortId;
  planeMode: PlaneMode;
  customBluePlane: Plane;
  customRedPlane: Plane;
}

export interface PerformerSettings {
  effortId: EffortId | null;
  prop: PropType | null;
  /**
   * Single active per-performer effect (the canonical EffectType, one at a
   * time). `null` = inherit the global default (config.tipEffectMap wildcard);
   * `"none"` = explicitly off; any other EffectType = that effect.
   */
  effect: EffectType | null;
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
    effect: null,
    staffLengthCm: null,
  };
}

/**
 * Standalone defaults for call sites that don't have a viewer-level defaults provider.
 * Used by museum, village, and other standalone avatar consumers.
 * Task 3 of the settings cascade plan wires up the viewer-level defaults;
 * this provides the same values as a fallback for standalone usage.
 */
export function makeStandaloneDefaults(): DefaultPerformerSettings {
  return {
    prop: PropType.STAFF,
    effortId: "linear" as EffortId,
    planeMode: PlaneMode.WALL,
    customBluePlane: Plane.WALL,
    customRedPlane: Plane.WALL,
  };
}
