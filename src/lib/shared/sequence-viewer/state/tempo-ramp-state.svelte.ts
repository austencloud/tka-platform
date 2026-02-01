/**
 * Tempo Ramp State (Svelte 5 Runes)
 *
 * Reactive state for tempo ramp training sessions.
 * Wraps the TempoRampOrchestrator with Svelte reactivity
 * and persists config + personal bests to localStorage.
 */

import type { TempoRampConfig, TempoRampProgress } from "../services/contracts/ITempoRampOrchestrator";

const STORAGE_KEY_CONFIG = "tka-ramp-config";
const STORAGE_KEY_BESTS = "tka-ramp-bests";

interface PersonalBest {
  sequenceId: string;
  maxBpm: number;
  timestamp: number;
}

function loadConfig(): Partial<TempoRampConfig> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (raw) return JSON.parse(raw);
  } catch {
    // Ignore parse errors
  }
  return {};
}

function saveConfig(config: Partial<TempoRampConfig>): void {
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
 * Create a reactive tempo ramp state instance.
 * One instance per modal/viewer context.
 */
export function createTempoRampState() {
  // Persisted user config preferences
  let userConfig = $state<Partial<TempoRampConfig>>(loadConfig());

  // Reactive progress (mirrors orchestrator state)
  let progress = $state<TempoRampProgress>({
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

  function updateProgress(p: TempoRampProgress) {
    progress = { ...p };
  }

  function updateConfig(config: Partial<TempoRampConfig>) {
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

export type TempoRampState = ReturnType<typeof createTempoRampState>;
