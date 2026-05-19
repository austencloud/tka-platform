/**
 * Scene Lab State
 *
 * Factory that holds the currently-previewed scene and a live mutable config
 * for each scene type. Param sliders mutate nested fields directly; Svelte 5's
 * deep $state reactivity propagates changes into the scene components.
 *
 * All configs and the active scene selection persist to localStorage so tweaks
 * survive refresh. Saves are debounced at 500ms to handle slider scrubbing.
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
import { loadSceneLabState } from "../services/scene-lab-persistence";

export function createSceneLabState() {
  const persisted = loadSceneLabState();

  let sceneId = $state<SceneId>(persisted?.sceneId ?? "winter");
  let winterConfig = $state<WinterSceneConfig>(
    persisted?.configs.winter ?? createDefaultWinterConfig()
  );
  let forestFireflyConfig = $state<ForestSceneConfig>(
    persisted?.configs.forestFirefly ?? createDefaultForestFireflyConfig()
  );
  let forestAutumnConfig = $state<AutumnSceneConfig>(
    persisted?.configs.forestAutumn ?? createDefaultAutumnConfig()
  );
  let cosmicNightConfig = $state<CosmicSceneConfig>(
    persisted?.configs.cosmicNight ?? createDefaultCosmicNightConfig()
  );
  let cosmicAuroraConfig = $state<CosmicSceneConfig>(
    persisted?.configs.cosmicAurora ?? createDefaultCosmicAuroraConfig()
  );
  let oceanDeepConfig = $state<OceanSceneConfig>(
    persisted?.configs.oceanDeep ?? createDefaultOceanDeepConfig()
  );
  let oceanReefConfig = $state<OceanSceneConfig>(
    persisted?.configs.oceanReef ?? createDefaultOceanReefConfig()
  );

  // JSON.stringify reads through Svelte's reactive proxies, setting up deep
  // tracking so any nested slider change triggers a debounced save.
  $effect(() => {
    const serialized = JSON.stringify({
      version: 1,
      sceneId,
      configs: {
        winter: winterConfig,
        forestFirefly: forestFireflyConfig,
        forestAutumn: forestAutumnConfig,
        cosmicNight: cosmicNightConfig,
        cosmicAurora: cosmicAuroraConfig,
        oceanDeep: oceanDeepConfig,
        oceanReef: oceanReefConfig,
      },
    });
    const timer = setTimeout(() => {
      try {
        localStorage.setItem("scene-lab-state", serialized);
      } catch {
        // noop
      }
    }, 500);
    return () => clearTimeout(timer);
  });

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
