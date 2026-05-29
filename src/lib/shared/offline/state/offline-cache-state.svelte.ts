/**
 * Offline Cache State Factory
 *
 * Reactive wrapper around OfflineCacheOrchestrator.
 * DI service holds logic, this factory adds Svelte 5 reactivity.
 */

import type { OfflineCacheOrchestrator } from "../services/offline-cache-orchestrator";
import type {
  OfflineCachePhase,
  OfflineCacheProgress,
  OfflineCacheStats,
} from "../domain/offline-cache-types";

export interface OfflineCacheState {
  readonly phase: OfflineCachePhase;
  readonly progress: OfflineCacheProgress;
  readonly isOfflineReady: boolean;
  startBackgroundCache(): Promise<void>;
  downloadForOffline(): Promise<void>;
  cancel(): void;
  getCacheStats(): Promise<OfflineCacheStats>;
  clearOfflineCache(): Promise<void>;
}

export function createOfflineCacheState(orchestrator: OfflineCacheOrchestrator): OfflineCacheState {
  let phase = $state<OfflineCachePhase>("idle");
  let progress = $state<OfflineCacheProgress>({ cached: 0, total: 0, currentTask: "" });
  let isOfflineReady = $state(false);

  async function startBackgroundCache() {
    phase = "caching";
    progress = { cached: 0, total: 0, currentTask: "Gallery metadata" };
    try {
      await orchestrator.startBackgroundCache();
      const stats = await orchestrator.getCacheStats();
      isOfflineReady = stats.isOfflineReady;
      phase = "ready";
    } catch {
      phase = "error";
    }
  }

  async function downloadForOffline() {
    phase = "caching";
    progress = { cached: 0, total: 0, currentTask: "Downloading..." };
    try {
      await orchestrator.downloadForOffline();
      const stats = await orchestrator.getCacheStats();
      isOfflineReady = stats.isOfflineReady;
      phase = "ready";
    } catch {
      phase = "error";
    }
  }

  function cancel() {
    orchestrator.cancel();
    phase = "idle";
  }

  async function getCacheStats(): Promise<OfflineCacheStats> {
    return orchestrator.getCacheStats();
  }

  async function clearOfflineCache() {
    await orchestrator.clearOfflineCache();
    isOfflineReady = false;
    phase = "idle";
  }

  // Check initial state
  orchestrator.getCacheStats().then((stats) => {
    isOfflineReady = stats.isOfflineReady;
    if (stats.isOfflineReady) phase = "ready";
  });

  return {
    get phase() { return phase; },
    get progress() { return progress; },
    get isOfflineReady() { return isOfflineReady; },
    startBackgroundCache,
    downloadForOffline,
    cancel,
    getCacheStats,
    clearOfflineCache,
  };
}
