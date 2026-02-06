/**
 * Train Challenges State
 *
 * Manages UI state AND cached data for the Challenges tab.
 * Data is cached at module level to prevent reloading on tab switches.
 */

import type {
  TrainChallenge,
  UserTrainChallengeProgress,
} from "../domain/models/TrainChallengeModels";
import type { ITrainChallengeManager } from "../services/contracts/ITrainChallengeManager";

interface ChallengesTabState {
  selectedChallengeId: string | null;
  filter: "all" | "active" | "completed";
  sortBy: "difficulty" | "xp" | "deadline";
}

const DEFAULT_STATE: ChallengesTabState = {
  selectedChallengeId: null,
  filter: "active",
  sortBy: "deadline",
};

function createTrainChallengesState() {
  // UI state
  const uiState = $state<ChallengesTabState>({ ...DEFAULT_STATE });

  // Data cache
  let challenges = $state<TrainChallenge[]>([]);
  let progressMap = $state<Map<string, UserTrainChallengeProgress>>(new Map());
  let isLoaded = $state(false);
  let isLoading = $state(false);

  function selectChallenge(challengeId: string | null) {
    uiState.selectedChallengeId = challengeId;
  }

  function setFilter(filter: "all" | "active" | "completed") {
    uiState.filter = filter;
  }

  function setSortBy(sortBy: "difficulty" | "xp" | "deadline") {
    uiState.sortBy = sortBy;
  }

  /**
   * Load challenges data if not already cached
   */
  async function loadChallenges(
    service: ITrainChallengeManager
  ): Promise<void> {
    // If already loaded, skip
    if (isLoaded) return;

    // If already loading, skip
    if (isLoading) return;

    isLoading = true;

    try {
      const [challengesData, progressData] = await Promise.all([
        service.getActiveChallenges(),
        service.getUserChallengeProgress(),
      ]);

      challenges = challengesData;

      // Build progress map
      const newProgressMap = new Map<string, UserTrainChallengeProgress>();
      progressData.forEach((p) => {
        newProgressMap.set(p.challengeId, p);
      });
      progressMap = newProgressMap;

      isLoaded = true;
    } catch (error) {
      console.error("[TrainChallengesState] Failed to load challenges:", error);
    } finally {
      isLoading = false;
    }
  }

  /**
   * Force reload challenges data (bypasses cache)
   */
  async function refreshChallenges(
    service: ITrainChallengeManager
  ): Promise<void> {
    isLoaded = false;
    await loadChallenges(service);
  }

  /**
   * Update progress for a specific challenge
   */
  function updateProgress(
    challengeId: string,
    progress: UserTrainChallengeProgress
  ) {
    progressMap.set(challengeId, progress);
    // Force reactivity by creating new map reference
    progressMap = new Map(progressMap);
  }

  return {
    // UI state
    get selectedChallengeId() {
      return uiState.selectedChallengeId;
    },
    get filter() {
      return uiState.filter;
    },
    get sortBy() {
      return uiState.sortBy;
    },
    selectChallenge,
    setFilter,
    setSortBy,

    // Data cache
    get challenges() {
      return challenges;
    },
    get progressMap() {
      return progressMap;
    },
    get isLoaded() {
      return isLoaded;
    },
    get isLoading() {
      return isLoading;
    },
    loadChallenges,
    refreshChallenges,
    updateProgress,
  };
}

// Module singleton instance
let challengesStateInstance: ReturnType<
  typeof createTrainChallengesState
> | null = null;

/**
 * Get the challenges state singleton
 */
function getChallengesState() {
  if (!challengesStateInstance) {
    challengesStateInstance = createTrainChallengesState();
  }
  return challengesStateInstance;
}

// Export a proxy that delegates to the singleton
export const trainChallengesState = {
  // UI state
  get selectedChallengeId() {
    return getChallengesState().selectedChallengeId;
  },
  get filter() {
    return getChallengesState().filter;
  },
  get sortBy() {
    return getChallengesState().sortBy;
  },
  selectChallenge(challengeId: string | null) {
    getChallengesState().selectChallenge(challengeId);
  },
  setFilter(filter: "all" | "active" | "completed") {
    getChallengesState().setFilter(filter);
  },
  setSortBy(sortBy: "difficulty" | "xp" | "deadline") {
    getChallengesState().setSortBy(sortBy);
  },

  // Data cache
  get challenges() {
    return getChallengesState().challenges;
  },
  get progressMap() {
    return getChallengesState().progressMap;
  },
  get isLoaded() {
    return getChallengesState().isLoaded;
  },
  get isLoading() {
    return getChallengesState().isLoading;
  },
  loadChallenges(service: ITrainChallengeManager) {
    return getChallengesState().loadChallenges(service);
  },
  refreshChallenges(service: ITrainChallengeManager) {
    return getChallengesState().refreshChallenges(service);
  },
  updateProgress(challengeId: string, progress: UserTrainChallengeProgress) {
    getChallengesState().updateProgress(challengeId, progress);
  },
};

export type { ChallengesTabState };
export type TrainChallengesState = ReturnType<
  typeof createTrainChallengesState
>;
