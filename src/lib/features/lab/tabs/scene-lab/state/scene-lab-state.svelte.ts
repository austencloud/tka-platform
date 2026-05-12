/**
 * Scene Lab State
 *
 * Factory that holds the currently-previewed scene and a live mutable config
 * for each scene type. Param sliders mutate nested fields directly; Svelte 5's
 * deep $state reactivity propagates changes into the scene components.
 */

import {
  type ForestSceneConfig,
  type WinterSceneConfig,
  type CosmicSceneConfig,
  createDefaultForestAutumnConfig,
  createDefaultForestFireflyConfig,
  createDefaultWinterConfig,
  createDefaultCosmicNightConfig,
  createDefaultCosmicAuroraConfig,
} from "$lib/shared/3d/environments/domain/models/scene-configs";
import type { SceneId } from "../domain/scene-lab-types";

export function createSceneLabState() {
  let sceneId = $state<SceneId>("winter");
  let winterConfig = $state<WinterSceneConfig>(createDefaultWinterConfig());
  let forestFireflyConfig = $state<ForestSceneConfig>(
    createDefaultForestFireflyConfig()
  );
  let forestAutumnConfig = $state<ForestSceneConfig>(
    createDefaultForestAutumnConfig()
  );
  let cosmicNightConfig = $state<CosmicSceneConfig>(
    createDefaultCosmicNightConfig()
  );
  let cosmicAuroraConfig = $state<CosmicSceneConfig>(
    createDefaultCosmicAuroraConfig()
  );

  function resetCurrent() {
    if (sceneId === "winter") winterConfig = createDefaultWinterConfig();
    else if (sceneId === "forest-firefly")
      forestFireflyConfig = createDefaultForestFireflyConfig();
    else if (sceneId === "forest-autumn")
      forestAutumnConfig = createDefaultForestAutumnConfig();
    else if (sceneId === "cosmic-night")
      cosmicNightConfig = createDefaultCosmicNightConfig();
    else if (sceneId === "cosmic-aurora")
      cosmicAuroraConfig = createDefaultCosmicAuroraConfig();
  }

  function currentConfigSnapshot(): unknown {
    if (sceneId === "winter") return $state.snapshot(winterConfig);
    if (sceneId === "forest-firefly") return $state.snapshot(forestFireflyConfig);
    if (sceneId === "forest-autumn") return $state.snapshot(forestAutumnConfig);
    if (sceneId === "cosmic-night") return $state.snapshot(cosmicNightConfig);
    return $state.snapshot(cosmicAuroraConfig);
  }

  function currentDefaultFnName(): string {
    switch (sceneId) {
      case "winter":
        return "createDefaultWinterConfig";
      case "forest-firefly":
        return "createDefaultForestFireflyConfig";
      case "forest-autumn":
        return "createDefaultForestAutumnConfig";
      case "cosmic-night":
        return "createDefaultCosmicNightConfig";
      case "cosmic-aurora":
        return "createDefaultCosmicAuroraConfig";
    }
  }

  function currentConfigTypeName(): string {
    if (sceneId === "winter") return "WinterSceneConfig";
    if (sceneId.startsWith("forest")) return "ForestSceneConfig";
    return "CosmicSceneConfig";
  }

  async function copyCurrentToClipboard(): Promise<void> {
    const snapshot = currentConfigSnapshot();
    const tsCode = `export function ${currentDefaultFnName()}(): ${currentConfigTypeName()} {\n  return ${JSON.stringify(snapshot, null, 2)};\n}\n`;
    await navigator.clipboard.writeText(tsCode);
  }

  return {
    get sceneId() {
      return sceneId;
    },
    setSceneId(id: SceneId) {
      sceneId = id;
    },
    get winterConfig() {
      return winterConfig;
    },
    get forestFireflyConfig() {
      return forestFireflyConfig;
    },
    get forestAutumnConfig() {
      return forestAutumnConfig;
    },
    get cosmicNightConfig() {
      return cosmicNightConfig;
    },
    get cosmicAuroraConfig() {
      return cosmicAuroraConfig;
    },
    resetCurrent,
    copyCurrentToClipboard,
  };
}

export type SceneLabState = ReturnType<typeof createSceneLabState>;
