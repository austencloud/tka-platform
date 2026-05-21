import type { SceneId } from "../domain/scene-lab-types";
import type {
  WinterSceneConfig,
  ForestSceneConfig,
  AutumnSceneConfig,
  CosmicSceneConfig,
  OceanSceneConfig,
  EmberSceneConfig,
  BlossomSceneConfig,
  CelestialSceneConfig,
  RainbowSceneConfig,
  VoidSceneConfig,
} from "$lib/shared/3d/environments/domain/models/scene-configs";

const STORAGE_KEY = "scene-lab-state";
const CURRENT_VERSION = 2;

export interface PersistedSceneLabConfigs {
  winter: WinterSceneConfig;
  forest: ForestSceneConfig;
  autumn: AutumnSceneConfig;
  cosmicNight: CosmicSceneConfig;
  cosmicAurora: CosmicSceneConfig;
  ocean: OceanSceneConfig;
  ember: EmberSceneConfig;
  blossom: BlossomSceneConfig;
  celestial: CelestialSceneConfig;
  rainbow: RainbowSceneConfig;
  void: VoidSceneConfig;
}

export type CosmicVariant = "night" | "aurora";

export interface PersistedSceneLabState {
  version: number;
  sceneId: SceneId;
  cosmicVariant: CosmicVariant;
  configs: PersistedSceneLabConfigs;
}

const SCENE_ID_MIGRATION: Record<string, SceneId> = {
  "forest-firefly": "forest",
  "forest-autumn": "autumn",
  "cosmic-night": "cosmic",
  "cosmic-aurora": "cosmic",
  "ocean-abyss": "ocean",
  "ocean-reef": "ocean",
  "ocean-mystical": "ocean",
  "ocean-cinematic": "ocean",
};

function migrateV1(raw: Record<string, unknown>): PersistedSceneLabState | null {
  const oldSceneId = raw.sceneId as string;
  const configs = raw.configs as Record<string, unknown> | undefined;
  if (!configs) return null;

  const migratedSceneId: SceneId = (SCENE_ID_MIGRATION[oldSceneId] ?? oldSceneId) as SceneId;

  let cosmicVariant: CosmicVariant = "night";
  if (oldSceneId === "cosmic-aurora") cosmicVariant = "aurora";

  return {
    version: CURRENT_VERSION,
    sceneId: migratedSceneId,
    cosmicVariant,
    configs: {
      winter: configs.winter as WinterSceneConfig,
      forest: (configs.forestFirefly ?? configs.forest) as ForestSceneConfig,
      autumn: (configs.forestAutumn ?? configs.autumn) as AutumnSceneConfig,
      cosmicNight: (configs.cosmicNight ?? configs.cosmic) as CosmicSceneConfig,
      cosmicAurora: configs.cosmicAurora as CosmicSceneConfig,
      ocean: (configs.oceanReef ?? configs.ocean) as OceanSceneConfig,
      ember: configs.ember as EmberSceneConfig,
      blossom: (configs.blossom ?? configs.cherryBlossom) as BlossomSceneConfig,
      celestial: configs.celestial as CelestialSceneConfig,
      rainbow: configs.rainbow as RainbowSceneConfig,
      void: (configs.void ?? configs.pureBlack) as VoidSceneConfig,
    },
  };
}

export function saveSceneLabState(data: PersistedSceneLabState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn("Failed to save scene lab state:", e);
  }
}

export function loadSceneLabState(): PersistedSceneLabState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Record<string, unknown>;

    if (data.version === CURRENT_VERSION) return data as unknown as PersistedSceneLabState;
    if (data.version === 1) return migrateV1(data);

    return null;
  } catch {
    return null;
  }
}

export function clearSceneLabState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // noop
  }
}
