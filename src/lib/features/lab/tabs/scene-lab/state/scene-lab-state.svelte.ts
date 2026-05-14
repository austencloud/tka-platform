/**
 * Scene Lab State
 *
 * Factory that holds the currently-previewed scene and a live mutable config
 * for each scene type. Param sliders mutate nested fields directly; Svelte 5's
 * deep $state reactivity propagates changes into the scene components.
 */

import {
  type ForestSceneConfig,
  type AutumnSceneConfig,
  type WinterSceneConfig,
  type CosmicSceneConfig,
  type OceanSceneConfig,
  createDefaultAutumnConfig,
  createDefaultForestFireflyConfig,
  createDefaultWinterConfig,
  createDefaultCosmicNightConfig,
  createDefaultCosmicAuroraConfig,
  createDefaultOceanDeepConfig,
  createDefaultOceanReefConfig,
} from "$lib/shared/3d/environments/domain/models/scene-configs";
import type { SceneId } from "../domain/scene-lab-types";

export function createSceneLabState() {
  let sceneId = $state<SceneId>("winter");
  let winterConfig = $state<WinterSceneConfig>(createDefaultWinterConfig());
  let forestFireflyConfig = $state<ForestSceneConfig>(
    createDefaultForestFireflyConfig()
  );
  let forestAutumnConfig = $state<AutumnSceneConfig>(
    createDefaultAutumnConfig()
  );
  let cosmicNightConfig = $state<CosmicSceneConfig>(
    createDefaultCosmicNightConfig()
  );
  let cosmicAuroraConfig = $state<CosmicSceneConfig>(
    createDefaultCosmicAuroraConfig()
  );
  let oceanDeepConfig = $state<OceanSceneConfig>(createDefaultOceanDeepConfig());
  let oceanReefConfig = $state<OceanSceneConfig>(createDefaultOceanReefConfig());

  function resetCurrent() {
    if (sceneId === "winter") winterConfig = createDefaultWinterConfig();
    else if (sceneId === "forest-firefly")
      forestFireflyConfig = createDefaultForestFireflyConfig();
    else if (sceneId === "forest-autumn")
      forestAutumnConfig = createDefaultAutumnConfig();
    else if (sceneId === "cosmic-night")
      cosmicNightConfig = createDefaultCosmicNightConfig();
    else if (sceneId === "cosmic-aurora")
      cosmicAuroraConfig = createDefaultCosmicAuroraConfig();
    else if (sceneId === "ocean-deep")
      oceanDeepConfig = createDefaultOceanDeepConfig();
    else if (sceneId === "ocean-reef")
      oceanReefConfig = createDefaultOceanReefConfig();
  }

  function currentConfigSnapshot(): unknown {
    if (sceneId === "winter") return $state.snapshot(winterConfig);
    if (sceneId === "forest-firefly") return $state.snapshot(forestFireflyConfig);
    if (sceneId === "forest-autumn") return $state.snapshot(forestAutumnConfig);
    if (sceneId === "cosmic-night") return $state.snapshot(cosmicNightConfig);
    if (sceneId === "ocean-deep") return $state.snapshot(oceanDeepConfig);
    if (sceneId === "ocean-reef") return $state.snapshot(oceanReefConfig);
    return $state.snapshot(cosmicAuroraConfig);
  }

  function currentDefaultFnName(): string {
    switch (sceneId) {
      case "winter":
        return "createDefaultWinterConfig";
      case "forest-firefly":
        return "createDefaultForestFireflyConfig";
      case "forest-autumn":
        return "createDefaultAutumnConfig";
      case "cosmic-night":
        return "createDefaultCosmicNightConfig";
      case "cosmic-aurora":
        return "createDefaultCosmicAuroraConfig";
      case "ocean-deep":
        return "createDefaultOceanDeepConfig";
      case "ocean-reef":
        return "createDefaultOceanReefConfig";
    }
  }

  function currentConfigTypeName(): string {
    if (sceneId === "winter") return "WinterSceneConfig";
    if (sceneId === "forest-firefly") return "ForestSceneConfig";
    if (sceneId === "forest-autumn") return "AutumnSceneConfig";
    if (sceneId.startsWith("ocean")) return "OceanSceneConfig";
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
    get oceanDeepConfig() {
      return oceanDeepConfig;
    },
    get oceanReefConfig() {
      return oceanReefConfig;
    },
    resetCurrent,
    copyCurrentToClipboard,
  };
}

export type SceneLabState = ReturnType<typeof createSceneLabState>;
