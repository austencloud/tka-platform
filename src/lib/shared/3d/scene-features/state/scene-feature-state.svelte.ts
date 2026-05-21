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
  let progressMap = $state<Record<string, number>>({});

  function getEnabledAsyncFeatures(): SceneFeature[] {
    return SCENE_FEATURES.filter((f) => f.requiresAsyncLoad && enabledMap[f.key]);
  }

  function isEnabled(key: string): boolean {
    return enabledMap[key] ?? false;
  }

  function isReady(key: string): boolean {
    return readySet.has(key);
  }

  function toggle(key: string): void {
    const current = enabledMap[key] ?? false;
    enabledMap = { ...enabledMap, [key]: !current };

    const stored = loadPersistedToggles();
    stored[key] = !current;
    persistToggles(stored);
  }

  function reportProgress(key: string, fraction: number): void {
    const clamped = Math.max(0, Math.min(1, fraction));
    if (progressMap[key] === clamped) return;
    console.debug(`[SceneFeature] ${key} progress: ${(clamped * 100).toFixed(0)}%`);
    progressMap = { ...progressMap, [key]: clamped };
  }

  function reportReady(key: string): void {
    if (readySet.has(key)) return;
    console.debug(`[SceneFeature] ${key} READY`);
    readySet = new Set([...readySet, key]);
  }

  function resetReady(key: string): void {
    if (!readySet.has(key)) return;
    const next = new Set(readySet);
    next.delete(key);
    readySet = next;
    const { [key]: _, ...rest } = progressMap;
    progressMap = rest;
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
    isReady,
    toggle,
    reportProgress,
    reportReady,
    resetReady,
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
      let sum = 0;
      for (const f of asyncFeatures) {
        if (readySet.has(f.key)) {
          sum += 1;
        } else {
          sum += progressMap[f.key] ?? 0;
        }
      }
      return sum / asyncFeatures.length;
    },
    reset,
  };
}

export type SceneFeatureState = ReturnType<typeof createSceneFeatureState>;
