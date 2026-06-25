/**
 * Tempo Practice State (Svelte 5 Runes)
 *
 * Reactive state for tempo practice training sessions.
 * Wraps the TempoPracticeOrchestrator with Svelte reactivity
 * and persists the user's ramp config to localStorage.
 */

import type { TempoPracticeConfig, TempoPracticeProgress } from "../services/tempo-practice-orchestrator";
const STORAGE_KEY_CONFIG = "tka-practice-config";

function loadConfig(): Partial<TempoPracticeConfig> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (raw) return JSON.parse(raw);
  } catch {
    // Ignore parse errors
  }
  return {};
}

function saveConfig(config: Partial<TempoPracticeConfig>): void {
  try {
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Create a reactive tempo practice state instance.
 * One instance per modal/viewer context.
 */
export function createTempoPracticeState() {
  // Persisted user config preferences
  let userConfig = $state<Partial<TempoPracticeConfig>>(loadConfig());

  // Reactive progress (mirrors orchestrator state)
  let progress = $state<TempoPracticeProgress>({
    active: false,
    currentBpm: 0,
    currentRound: 0,
    roundsPerLevel: 5,
    currentLevel: 0,
    totalRoundsCompleted: 0,
    progressionMode: "manual",
    readyToAdvance: false,
  });

  // Completion message state
  let completionMessage = $state<string | null>(null);
  let completionTimeout: ReturnType<typeof setTimeout> | null = null;

  function updateProgress(p: TempoPracticeProgress) {
    progress = { ...p };
  }

  function updateConfig(config: Partial<TempoPracticeConfig>) {
    userConfig = { ...userConfig, ...config };
    saveConfig(userConfig);
  }

  function showCompletion(finalBpm: number) {
    completionMessage = `Reached ${finalBpm} BPM`;
    if (completionTimeout) clearTimeout(completionTimeout);
    completionTimeout = setTimeout(() => {
      completionMessage = null;
    }, 3000);
  }

  function clearCompletion() {
    completionMessage = null;
    if (completionTimeout) {
      clearTimeout(completionTimeout);
      completionTimeout = null;
    }
  }

  return {
    get progress() { return progress; },
    get userConfig() { return userConfig; },
    get completionMessage() { return completionMessage; },
    updateProgress,
    updateConfig,
    showCompletion,
    clearCompletion,
  };
}

export type TempoPracticeState = ReturnType<typeof createTempoPracticeState>;
