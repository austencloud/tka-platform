import type { EffectConfig } from "../../domain/types";
import type { FireOverlayConfig } from "$lib/shared/animation-engine/domain/types/FireTypes";
import type { LedOverlayConfig } from "$lib/shared/animation-engine/domain/types/LedTypes";
import type { TrailSettings } from "$lib/shared/animation-engine/domain/types/TrailTypes";

export interface IEffectConfigMapper {
  toFireConfig(effect: EffectConfig["fire"]): FireOverlayConfig;
  toLedConfig(effect: EffectConfig["led"]): LedOverlayConfig;
  toTrailSettings(effect: EffectConfig["trails"]): TrailSettings;
}
