/**
 * Train Progress State
 *
 * Manages UI state for the Progress tab.
 */

interface ProgressTabState {
  timeRange: "week" | "month" | "all";
  sortBy: "date" | "score" | "accuracy";
  selectedSessionId: string | null;
}

const DEFAULT_STATE: ProgressTabState = {
  timeRange: "week",
  sortBy: "date",
  selectedSessionId: null,
};

export function createTrainProgressState() {
  const state = $state<ProgressTabState>({ ...DEFAULT_STATE });

  function setTimeRange(range: "week" | "month" | "all") {
    state.timeRange = range;
  }

  function setSortBy(sortBy: "date" | "score" | "accuracy") {
    state.sortBy = sortBy;
  }

  function selectSession(sessionId: string | null) {
    state.selectedSessionId = sessionId;
  }

  return {
    get timeRange() {
      return state.timeRange;
    },
    get sortBy() {
      return state.sortBy;
    },
    get selectedSessionId() {
      return state.selectedSessionId;
    },
    setTimeRange,
    setSortBy,
    selectSession,
  };
}

export type { ProgressTabState };
