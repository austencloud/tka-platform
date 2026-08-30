import {
  TRANSITION_REVIEW_GATES,
  TRANSITION_REVIEW_STORAGE_KEY,
  createEmptyTransitionReviewDecisions,
  parseTransitionReviewDecisions,
  type TransitionReviewGateId,
  type TransitionReviewStatus,
} from "./transition-review-gates";

export function createTransitionReviewState() {
  let activeGateId = $state<TransitionReviewGateId>("split-focus");
  let decisions = $state(createEmptyTransitionReviewDecisions());
  let storageAvailable = $state(true);

  function persist(): void {
    try {
      localStorage.setItem(
        TRANSITION_REVIEW_STORAGE_KEY,
        JSON.stringify(decisions)
      );
      storageAvailable = true;
    } catch {
      storageAvailable = false;
    }
  }

  function load(): void {
    try {
      decisions = parseTransitionReviewDecisions(
        localStorage.getItem(TRANSITION_REVIEW_STORAGE_KEY)
      );
      storageAvailable = true;
    } catch {
      decisions = createEmptyTransitionReviewDecisions();
      storageAvailable = false;
    }
  }

  function selectGate(gateId: TransitionReviewGateId): void {
    const gate = TRANSITION_REVIEW_GATES.find(
      (candidate) => candidate.id === gateId
    );
    if (gate?.availability === "ready") activeGateId = gateId;
  }

  function updateNote(note: string): void {
    decisions = {
      ...decisions,
      [activeGateId]: { ...decisions[activeGateId], note },
    };
    persist();
  }

  function mark(status: Exclude<TransitionReviewStatus, "not-reviewed">): void {
    decisions = {
      ...decisions,
      [activeGateId]: {
        ...decisions[activeGateId],
        status,
        reviewedAt: new Date().toISOString(),
      },
    };
    persist();
  }

  return {
    get activeGateId() {
      return activeGateId;
    },
    get activeGate() {
      return (
        TRANSITION_REVIEW_GATES.find((gate) => gate.id === activeGateId) ??
        TRANSITION_REVIEW_GATES[0]
      );
    },
    get activeDecision() {
      return decisions[activeGateId];
    },
    get decisions() {
      return decisions;
    },
    get storageAvailable() {
      return storageAvailable;
    },
    load,
    selectGate,
    updateNote,
    mark,
  };
}
