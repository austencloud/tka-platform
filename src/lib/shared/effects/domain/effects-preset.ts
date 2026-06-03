import type { EffectsConfig, EffectType } from "./effects-config";

/**
 * Deep partial - every field optional, recursively.
 * Used for preset patches so a preset can touch only the fields
 * it cares about without declaring the full config shape.
 */
export type DeepPartial<T> = T extends object
  ? { [K in keyof T]?: DeepPartial<T[K]> }
  : T;

/**
 * A named, described effect preset.
 *
 * Presets are pure data - applying a preset is
 * `config = deepMerge(config, preset.patch)`, not an imperative
 * side-effect chain. This lets presets be serialized, composed,
 * previewed, and synced to Firestore.
 */
export interface EffectsPreset {
  id: string;
  name: string;
  description: string;
  /** Which effect picker this preset belongs to. */
  effectType: Exclude<EffectType, "none">;
  /** Pure data patch applied over current config. */
  patch: DeepPartial<EffectsConfig>;
  builtIn: boolean;
  /** Firestore uid - absent for built-in presets. */
  createdBy?: string;
  /** epoch ms - absent for built-in presets. */
  createdAt?: number;
  /** Optional thumbnail colors for the picker swatch. */
  previewColors?: [string, string];
}
