import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "../tunnel-config";
import {
  builtInTunnelPresetRecipe,
  cloneTunnelPresetRecipe,
  isTunnelPresetRecipeModified,
  savedTunnelPresetRecipe,
} from "../tunnel-preset-recipe";

describe("Tunnel preset recipe", () => {
  it("keeps the chosen built-in recipe as the reset target after config edits", () => {
    const recipe = builtInTunnelPresetRecipe("radial");
    expect(recipe).not.toBeNull();
    if (!recipe) return;

    const edited = { ...recipe.config, mirror: true };
    expect(isTunnelPresetRecipeModified(recipe, edited)).toBe(true);
    expect(cloneTunnelPresetRecipe(recipe)?.config).toEqual(recipe.config);
  });

  it("freezes a saved preset recipe instead of relying on its mutable local entry", () => {
    const config = { ...DEFAULT_CONFIG, fold: 4, staggerSteps: 1 };
    const recipe = savedTunnelPresetRecipe("saved-1", "Spiral practice", config);
    config.fold = 2;

    expect(recipe.config.fold).toBe(4);
    expect(isTunnelPresetRecipeModified(recipe, recipe.config)).toBe(false);
  });
});
