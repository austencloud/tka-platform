import type { EffortId } from "$lib/shared/effort/domain/effort-types";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";

export type EffectId =
  | "trails"
  | "fire"
  | "charcoal"
  | "led"
  | "electricity"
  | "sparkles"
  | "motion"
  | "bloom";

export interface PerformerSettings {
  effortId: EffortId;
  prop: PropType;
  effects: Set<EffectId>;
  staffLengthCm: number | null;
}

export function makeDefaultPerformerSettings(): PerformerSettings {
  return {
    effortId: "linear",
    prop: PropType.STAFF,
    effects: new Set(),
    staffLengthCm: null,
  };
}
