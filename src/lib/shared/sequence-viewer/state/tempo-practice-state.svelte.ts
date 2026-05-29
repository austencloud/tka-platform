/**
 * Tempo Practice State (Svelte 5 Runes)
 *
 * Reactive state for tempo practice training sessions.
 * Wraps the TempoPracticeOrchestrator with Svelte reactivity
 * and persists config + personal bests to localStorage.
 */

import type { TempoPracticeConfig, TempoPracticeProgress } from "../services/tempo-practice-orchestrator";
const STORAGE_KEY_CONFIG = "tka-practice-config";
const STORAGE_KEY_BESTS = "tka-practice-bests";

interface PersonalBest {
  sequenceId: string;
  maxBpm: number;
  timestamp: number;
}

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

function loadBests(): Map<string, PersonalBest> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_BESTS);
    if (raw) {
      const arr: PersonalBest[] = JSON.parse(raw);
      return new Map(arr.map((b) => [b.sequenceId, b]));
    }
  } catch {
    // Ignore parse errors
  }
  return new Map();
}

function saveBests(bests: Map<string, PersonalBest>): void {
  try {
    localStorage.setItem(STORAGE_KEY_BESTS, JSON.stringify([...bests.values()]));
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
  });

  // Completion message state
  let completionMessage = $state<string | null>(null);
  let completionTimeout: ReturnType<typeof setTimeout> | null = null;

  // Personal bests
  const bests = loadBests();

  function updateProgress(p: TempoPracticeProgress) {
    progress = { ...p };
  }

  function updateConfig(config: Partial<TempoPracticeConfig>) {
    userConfig = { ...userConfig, ...config };
    saveConfig(userConfig);
  }

  function recordPersonalBest(sequenceId: string, bpm: number) {
    const existing = bests.get(sequenceId);
    if (!existing || bpm > existing.maxBpm) {
      bests.set(sequenceId, {
        sequenceId,
        maxBpm: bpm,
        timestamp: Date.now(),
      });
      saveBests(bests);
    }
  }

  function getPersonalBest(sequenceId: string): number | null {
    return bests.get(sequenceId)?.maxBpm ?? null;
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
    recordPersonalBest,
    getPersonalBest,
    showCompletion,
    clearCompletion,
  };
}

export type TempoPracticeState = ReturnType<typeof createTempoPracticeState>;
