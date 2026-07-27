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

export interface SceneFeatureStateOptions {
  /**
   * Ignore the shared `tka-scene-features` key entirely, in both directions:
   * `overrides` become authoritative, and `toggle` stops writing. A saved-scene
   * preview owns its own feature set — it must show the features the scene was
   * saved with, not whatever the user last toggled in the real viewer, and it
   * must not write its choices back over them.
   */
  isolated?: boolean;
}

export function createSceneFeatureState(
  overrides?: Partial<Record<string, boolean>>,
  options?: SceneFeatureStateOptions
) {
  const isolated = options?.isolated ?? false;
  const persisted = isolated ? {} : loadPersistedToggles();

  // Three-tier precedence: localStorage > overrides > registry default
  // (isolated: overrides > registry default — localStorage is not consulted)
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
  let errorMap = $state<Record<string, string>>({});
  let retryRequestMap = $state<Record<string, number>>({});

  function getEnabledAsyncFeatures(): SceneFeature[] {
    return SCENE_FEATURES.filter((f) => f.requiresAsyncLoad && enabledMap[f.key]);
  }

  function isEnabled(key: string): boolean {
    return enabledMap[key] ?? false;
  }

  function isReady(key: string): boolean {
    return readySet.has(key);
  }

  function getError(key: string): string | null {
    return errorMap[key] ?? null;
  }

  function getRetryRequest(key: string): number {
    return retryRequestMap[key] ?? 0;
  }

  function toggle(key: string): void {
    const current = enabledMap[key] ?? false;
    enabledMap = { ...enabledMap, [key]: !current };
    if (isolated) return;

    const stored = loadPersistedToggles();
    stored[key] = !current;
    persistToggles(stored);
  }

  function reportProgress(key: string, fraction: number): void {
    const clamped = Math.max(0, Math.min(1, fraction));
    // Loading progress is monotonic within a load cycle: never let a late or
    // out-of-order reporter drag the bar backward (e.g. a second asset
    // resolving after the first has already climbed). resetReady() clears the
    // key, so a genuine reload starts fresh from 0.
    const current = progressMap[key] ?? 0;
    if (clamped <= current) return;
    console.debug(`[SceneFeature] ${key} progress: ${(clamped * 100).toFixed(0)}%`);
    progressMap = { ...progressMap, [key]: clamped };
  }

  function reportReady(key: string): void {
    // Idempotent by necessity: reporters call this from an $effect that reruns
    // whenever their asset stores settle (see ForestScene's per-GLB progress
    // effect). Rebuilding errorMap unconditionally handed that effect a brand
    // new object every run, so it invalidated itself forever —
    // effect_update_depth_exceeded. Only touch the maps when something actually
    // changes, and this becomes a no-op once the feature is ready.
    if (key in errorMap) {
      const { [key]: _, ...remainingErrors } = errorMap;
      errorMap = remainingErrors;
    }
    if (readySet.has(key)) return;
    console.debug(`[SceneFeature] ${key} READY`);
    readySet = new Set([...readySet, key]);
  }

  function reportFailed(key: string, message: string): void {
    if (readySet.has(key)) {
      const next = new Set(readySet);
      next.delete(key);
      readySet = next;
    }
    if (errorMap[key] === message) return;
    console.error(`[SceneFeature] ${key} FAILED: ${message}`);
    errorMap = { ...errorMap, [key]: message };
  }

  function resetReady(key: string): void {
    if (readySet.has(key)) {
      const next = new Set(readySet);
      next.delete(key);
      readySet = next;
    }
    const { [key]: _progress, ...remainingProgress } = progressMap;
    progressMap = remainingProgress;
    const { [key]: _error, ...remainingErrors } = errorMap;
    errorMap = remainingErrors;
  }

  function requestRetry(key: string): void {
    resetReady(key);
    retryRequestMap = {
      ...retryRequestMap,
      [key]: (retryRequestMap[key] ?? 0) + 1,
    };
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
    getError,
    getRetryRequest,
    toggle,
    reportProgress,
    reportReady,
    reportFailed,
    resetReady,
    requestRetry,
    get allEnabledReady(): boolean {
      const asyncFeatures = getEnabledAsyncFeatures();
      return (
        asyncFeatures.length === 0 ||
        asyncFeatures.every((f) => readySet.has(f.key))
      );
    },
    get allEnabledSettled(): boolean {
      const asyncFeatures = getEnabledAsyncFeatures();
      return (
        asyncFeatures.length === 0 ||
        asyncFeatures.every(
          (feature) =>
            readySet.has(feature.key) || errorMap[feature.key] !== undefined
        )
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
    get settledProgress(): number {
      const asyncFeatures = getEnabledAsyncFeatures();
      if (asyncFeatures.length === 0) return 1;
      let sum = 0;
      for (const feature of asyncFeatures) {
        if (readySet.has(feature.key) || errorMap[feature.key] !== undefined) {
          sum += 1;
        } else {
          sum += progressMap[feature.key] ?? 0;
        }
      }
      return sum / asyncFeatures.length;
    },
    reset,
  };
}

export type SceneFeatureState = ReturnType<typeof createSceneFeatureState>;
