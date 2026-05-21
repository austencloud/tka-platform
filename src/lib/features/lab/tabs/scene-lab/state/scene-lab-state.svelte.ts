import {
  type ForestSceneConfig,
  type AutumnSceneConfig,
  type WinterSceneConfig,
  type CosmicSceneConfig,
  type OceanSceneConfig,
  type EmberSceneConfig,
  type CherryBlossomSceneConfig,
  type CelestialSceneConfig,
  createDefaultAutumnConfig,
  createDefaultForestFireflyConfig,
  createDefaultWinterConfig,
  createDefaultCosmicNightConfig,
  createDefaultCosmicAuroraConfig,
  createDefaultOceanReefConfig,
  createDefaultEmberGlowConfig,
  createDefaultCherryBlossomConfig,
  createDefaultCelestialConfig,
} from "$lib/shared/3d/environments/domain/models/scene-configs";
import type { SceneId } from "../domain/scene-lab-types";
import type { CosmicVariant } from "../services/scene-lab-persistence";
import { loadSceneLabState } from "../services/scene-lab-persistence";

export function createSceneLabState() {
  const persisted = loadSceneLabState();

  let sceneId = $state<SceneId>(persisted?.sceneId ?? "winter");
  let cosmicVariant = $state<CosmicVariant>(persisted?.cosmicVariant ?? "night");

  let winterConfig = $state<WinterSceneConfig>(
    persisted?.configs.winter ?? createDefaultWinterConfig()
  );
  let forestConfig = $state<ForestSceneConfig>(
    persisted?.configs.forest ?? createDefaultForestFireflyConfig()
  );
  let autumnConfig = $state<AutumnSceneConfig>(
    persisted?.configs.autumn ?? createDefaultAutumnConfig()
  );
  let cosmicNightConfig = $state<CosmicSceneConfig>(
    persisted?.configs.cosmicNight ?? createDefaultCosmicNightConfig()
  );
  let cosmicAuroraConfig = $state<CosmicSceneConfig>(
    persisted?.configs.cosmicAurora ?? createDefaultCosmicAuroraConfig()
  );
  const persistedOcean = persisted?.configs.ocean;
  let oceanConfig = $state<OceanSceneConfig>(
    persistedOcean && "zones" in persistedOcean ? persistedOcean : createDefaultOceanReefConfig()
  );
  let emberConfig = $state<EmberSceneConfig>(
    persisted?.configs.ember ?? createDefaultEmberGlowConfig()
  );
  let cherryBlossomConfig = $state<CherryBlossomSceneConfig>(
    persisted?.configs.cherryBlossom ?? createDefaultCherryBlossomConfig()
  );
  let celestialConfig = $state<CelestialSceneConfig>(
    persisted?.configs.celestial ?? createDefaultCelestialConfig()
  );

  $effect(() => {
    const serialized = JSON.stringify({
      version: 2,
      sceneId,
      cosmicVariant,
      configs: {
        winter: winterConfig,
        forest: forestConfig,
        autumn: autumnConfig,
        cosmicNight: cosmicNightConfig,
        cosmicAurora: cosmicAuroraConfig,
        ocean: oceanConfig,
        ember: emberConfig,
        cherryBlossom: cherryBlossomConfig,
        celestial: celestialConfig,
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
    switch (sceneId) {
      case "winter": winterConfig = createDefaultWinterConfig(); break;
      case "forest": forestConfig = createDefaultForestFireflyConfig(); break;
      case "autumn": autumnConfig = createDefaultAutumnConfig(); break;
      case "cosmic":
        if (cosmicVariant === "night") cosmicNightConfig = createDefaultCosmicNightConfig();
        else cosmicAuroraConfig = createDefaultCosmicAuroraConfig();
        break;
      case "ocean": oceanConfig = createDefaultOceanReefConfig(); break;
      case "ember": emberConfig = createDefaultEmberGlowConfig(); break;
      case "cherry-blossom": cherryBlossomConfig = createDefaultCherryBlossomConfig(); break;
      case "celestial": celestialConfig = createDefaultCelestialConfig(); break;
    }
  }

  function currentConfigSnapshot(): unknown {
    switch (sceneId) {
      case "winter": return $state.snapshot(winterConfig);
      case "forest": return $state.snapshot(forestConfig);
      case "autumn": return $state.snapshot(autumnConfig);
      case "cosmic": return $state.snapshot(cosmicVariant === "night" ? cosmicNightConfig : cosmicAuroraConfig);
      case "ocean": return $state.snapshot(oceanConfig);
      case "ember": return $state.snapshot(emberConfig);
      case "cherry-blossom": return $state.snapshot(cherryBlossomConfig);
      case "celestial": return $state.snapshot(celestialConfig);
      default: return {};
    }
  }

  function currentDefaultFnName(): string {
    switch (sceneId) {
      case "winter": return "createDefaultWinterConfig";
      case "forest": return "createDefaultForestFireflyConfig";
      case "autumn": return "createDefaultAutumnConfig";
      case "cosmic": return cosmicVariant === "night" ? "createDefaultCosmicNightConfig" : "createDefaultCosmicAuroraConfig";
      case "ocean": return "createDefaultOceanReefConfig";
      case "ember": return "createDefaultEmberGlowConfig";
      case "cherry-blossom": return "createDefaultCherryBlossomConfig";
      case "celestial": return "createDefaultCelestialConfig";
      default: return "createDefaultWinterConfig";
    }
  }

  function currentConfigTypeName(): string {
    switch (sceneId) {
      case "winter": return "WinterSceneConfig";
      case "forest": return "ForestSceneConfig";
      case "autumn": return "AutumnSceneConfig";
      case "cosmic": return "CosmicSceneConfig";
      case "ocean": return "OceanSceneConfig";
      case "ember": return "EmberSceneConfig";
      case "cherry-blossom": return "CherryBlossomSceneConfig";
      case "celestial": return "CelestialSceneConfig";
      default: return "unknown";
    }
  }

  async function copyCurrentToClipboard(): Promise<void> {
    const snapshot = currentConfigSnapshot();
    const tsCode = `export function ${currentDefaultFnName()}(): ${currentConfigTypeName()} {\n  return ${JSON.stringify(snapshot, null, 2)};\n}\n`;
    await navigator.clipboard.writeText(tsCode);
  }

  return {
    get sceneId() { return sceneId; },
    setSceneId(id: SceneId) { sceneId = id; },
    get cosmicVariant() { return cosmicVariant; },
    setCosmicVariant(v: CosmicVariant) { cosmicVariant = v; },
    get winterConfig() { return winterConfig; },
    get forestConfig() { return forestConfig; },
    get autumnConfig() { return autumnConfig; },
    get cosmicNightConfig() { return cosmicNightConfig; },
    get cosmicAuroraConfig() { return cosmicAuroraConfig; },
    get oceanConfig() { return oceanConfig; },
    get emberConfig() { return emberConfig; },
    get cherryBlossomConfig() { return cherryBlossomConfig; },
    get celestialConfig() { return celestialConfig; },
    resetCurrent,
    copyCurrentToClipboard,
  };
}

export type SceneLabState = ReturnType<typeof createSceneLabState>;
