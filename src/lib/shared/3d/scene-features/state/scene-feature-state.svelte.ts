import { SCENE_FEATURES, type SceneFeature } from "../domain/scene-feature-registry";

const STORAGE_KEY = "tka-scene-features";

function loadPersistedToggles(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, boolean>;
  } catch {
    return {};
  }
}

function persistToggles(toggles: Record<string, boolean>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toggles));
}

export function createSceneFeatureState(
  overrides?: Partial<Record<string, boolean>>
) {
  const persisted = loadPersistedToggles();

  // Three-tier precedence: localStorage > overrides > registry default
  const initialToggles: Record<string, boolean> = {};
  for (const feature of SCENE_FEATURES) {
    if (feature.key in persisted) {
      initialToggles[feature.key] = persisted[feature.key]!;
    } else if (overrides && feature.key in overrides) {
      initialToggles[feature.key] = overrides[feature.key]!;
    } else {
      initialToggles[feature.key] = feature.defaultEnabled;
    }
  }

  let enabledMap = $state<Record<string, boolean>>({ ...initialToggles });
  let readySet = $state<Set<string>>(new Set());

  function getEnabledAsyncFeatures(): SceneFeature[] {
    return SCENE_FEATURES.filter((f) => f.requiresAsyncLoad && enabledMap[f.key]);
  }

  function isEnabled(key: string): boolean {
    return enabledMap[key] ?? false;
  }

  function toggle(key: string): void {
    const current = enabledMap[key] ?? false;
    enabledMap = { ...enabledMap, [key]: !current };

    const stored = loadPersistedToggles();
    stored[key] = !current;
    persistToggles(stored);
  }

  function reportReady(key: string): void {
    if (readySet.has(key)) return;
    readySet = new Set([...readySet, key]);
  }

  function reset(): void {
    localStorage.removeItem(STORAGE_KEY);
    const defaults: Record<string, boolean> = {};
    for (const feature of SCENE_FEATURES) {
      if (overrides && feature.key in overrides) {
        defaults[feature.key] = overrides[feature.key]!;
      } else {
        defaults[feature.key] = feature.defaultEnabled;
      }
    }
    enabledMap = { ...defaults };
  }

  return {
    get features(): readonly SceneFeature[] {
      return SCENE_FEATURES;
    },
    isEnabled,
    toggle,
    reportReady,
    get allEnabledReady(): boolean {
      const asyncFeatures = getEnabledAsyncFeatures();
      return (
        asyncFeatures.length === 0 ||
        asyncFeatures.every((f) => readySet.has(f.key))
      );
    },
    get readyProgress(): number {
      const asyncFeatures = getEnabledAsyncFeatures();
      if (asyncFeatures.length === 0) return 1;
      const readyCount = asyncFeatures.filter((f) => readySet.has(f.key)).length;
      return readyCount / asyncFeatures.length;
    },
    reset,
  };
}

export type SceneFeatureState = ReturnType<typeof createSceneFeatureState>;
