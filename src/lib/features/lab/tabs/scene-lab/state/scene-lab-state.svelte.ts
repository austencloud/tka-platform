import {
  type ForestSceneConfig,
  type AutumnSceneConfig,
  type WinterSceneConfig,
  type CosmicSceneConfig,
  type OceanSceneConfig,
  type EmberSceneConfig,
  type BlossomSceneConfig,
  type CelestialSceneConfig,
  type RainbowSceneConfig,
  type VoidSceneConfig,
  createDefaultAutumnConfig,
  createDefaultForestFireflyConfig,
  createDefaultWinterConfig,
  createDefaultCosmicNightConfig,
  createDefaultCosmicAuroraConfig,
  createDefaultOceanReefConfig,
  createDefaultEmberConfig,
  createDefaultBlossomConfig,
  createDefaultCelestialConfig,
  createDefaultRainbowConfig,
  createDefaultVoidConfig,
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
  const oceanDefaults = createDefaultOceanReefConfig();
  const persistedOcean = persisted?.configs.ocean;
  let oceanConfig = $state<OceanSceneConfig>(
    persistedOcean && "zones" in persistedOcean
      ? { ...oceanDefaults, ...persistedOcean }
      : oceanDefaults
  );
  let emberConfig = $state<EmberSceneConfig>(
    persisted?.configs.ember ?? createDefaultEmberConfig()
  );
  let blossomConfig = $state<BlossomSceneConfig>(
    persisted?.configs.blossom ?? createDefaultBlossomConfig()
  );
  let celestialConfig = $state<CelestialSceneConfig>(
    persisted?.configs.celestial ?? createDefaultCelestialConfig()
  );
  let rainbowConfig = $state<RainbowSceneConfig>(
    persisted?.configs.rainbow ?? createDefaultRainbowConfig()
  );
  let voidConfig = $state<VoidSceneConfig>(
    persisted?.configs.void ?? createDefaultVoidConfig()
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
        blossom: blossomConfig,
        celestial: celestialConfig,
        rainbow: rainbowConfig,
        void: voidConfig,
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
      case "ember": emberConfig = createDefaultEmberConfig(); break;
      case "blossom": blossomConfig = createDefaultBlossomConfig(); break;
      case "celestial": celestialConfig = createDefaultCelestialConfig(); break;
      case "rainbow": rainbowConfig = createDefaultRainbowConfig(); break;
      case "void": voidConfig = createDefaultVoidConfig(); break;
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
      case "blossom": return $state.snapshot(blossomConfig);
      case "celestial": return $state.snapshot(celestialConfig);
      case "rainbow": return $state.snapshot(rainbowConfig);
      case "void": return $state.snapshot(voidConfig);
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
      case "ember": return "createDefaultEmberConfig";
      case "blossom": return "createDefaultBlossomConfig";
      case "celestial": return "createDefaultCelestialConfig";
      case "rainbow": return "createDefaultRainbowConfig";
      case "void": return "createDefaultVoidConfig";
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
      case "blossom": return "BlossomSceneConfig";
      case "celestial": return "CelestialSceneConfig";
      case "rainbow": return "RainbowSceneConfig";
      case "void": return "VoidSceneConfig";
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
    get blossomConfig() { return blossomConfig; },
    get celestialConfig() { return celestialConfig; },
    get rainbowConfig() { return rainbowConfig; },
    get voidConfig() { return voidConfig; },
    resetCurrent,
    copyCurrentToClipboard,
  };
}

export type SceneLabState = ReturnType<typeof createSceneLabState>;
