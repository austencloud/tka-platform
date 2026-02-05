/**
 * Active Challenge State
 *
 * Manages the currently active challenge for the Practice tab.
 * When a challenge is started from the Challenges tab, it's stored here
 * and the Practice tab can read it to configure appropriately.
 */

import type { TrainChallenge } from "../domain/models/TrainChallengeModels";

function createActiveChallengeState() {
  let activeChallenge = $state<TrainChallenge | null>(null);

  function setActiveChallenge(challenge: TrainChallenge | null) {
    activeChallenge = challenge;
  }

  function clearActiveChallenge() {
    activeChallenge = null;
  }

  return {
    get activeChallenge() {
      return activeChallenge;
    },
    get hasActiveChallenge(): boolean {
      return activeChallenge !== null;
    },
    setActiveChallenge,
    clearActiveChallenge,
  };
}

// Module singleton instance
let activeChallengeInstance: ReturnType<
  typeof createActiveChallengeState
> | null = null;

/**
 * Get the active challenge state singleton
 */
export function getActiveChallengeState() {
  if (!activeChallengeInstance) {
    activeChallengeInstance = createActiveChallengeState();
  }
  return activeChallengeInstance;
}

// For backward compatibility, export a proxy that delegates to the singleton
// This allows existing code using `activeChallengeState.activeChallenge` to work
export const activeChallengeState = {
  get activeChallenge() {
    return getActiveChallengeState().activeChallenge;
  },
  get hasActiveChallenge() {
    return getActiveChallengeState().hasActiveChallenge;
  },
  setActiveChallenge(challenge: TrainChallenge | null) {
    getActiveChallengeState().setActiveChallenge(challenge);
  },
  clearActiveChallenge() {
    getActiveChallengeState().clearActiveChallenge();
  },
};

export type ActiveChallengeState = ReturnType<
  typeof createActiveChallengeState
>;
