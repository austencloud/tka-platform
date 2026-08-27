import {
  cloneTunnelConfig,
  configsEqual,
  getPreset,
  type TunnelConfig,
} from "./tunnel-config";

/** The named recipe an author started from. Its frozen config makes Reset
 * reliable even when a personal preset is later renamed, changed, or removed. */
export interface TunnelPresetRecipe {
  readonly kind: "built-in" | "saved";
  readonly id: string;
  readonly name: string;
  readonly config: TunnelConfig;
}

export function builtInTunnelPresetRecipe(
  id: string
): TunnelPresetRecipe | null {
  const preset = getPreset(id);
  return preset
    ? {
        kind: "built-in",
        id: preset.id,
        name: preset.name,
        config: cloneTunnelConfig(preset.config),
      }
    : null;
}

export function savedTunnelPresetRecipe(
  id: string,
  name: string,
  config: TunnelConfig
): TunnelPresetRecipe {
  return { kind: "saved", id, name, config: cloneTunnelConfig(config) };
}

export function cloneTunnelPresetRecipe(
  recipe: TunnelPresetRecipe | null
): TunnelPresetRecipe | null {
  return recipe && { ...recipe, config: cloneTunnelConfig(recipe.config) };
}

export function isTunnelPresetRecipeModified(
  recipe: TunnelPresetRecipe | null,
  config: TunnelConfig
): boolean {
  return recipe !== null && !configsEqual(recipe.config, config);
}
