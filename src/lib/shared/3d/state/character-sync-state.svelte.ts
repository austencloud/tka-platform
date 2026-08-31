/**
 * Character Sync State
 *
 * Manages synchronization between two character instances with beat offset.
 * When sync is enabled, the follower character mirrors the leader's playback
 * with a configurable beat offset (positive = ahead, negative = behind).
 */

import type { CharacterInstanceState } from "./character-instance-state.svelte";

export interface CharacterSyncConfig {
  isSyncEnabled: boolean;
  leaderCharacterId: "character1" | "character2";
  stepOffset: number; // -8 to +8
}

const MIN_OFFSET = -8;
const MAX_OFFSET = 8;

/**
 * Create sync state for two-character coordination
 *
 * Uses $effect.root() to allow creation outside component initialization
 * (e.g., inside onMount after async service loading).
 */
export function createCharacterSyncState(
  character1: CharacterInstanceState,
  character2: CharacterInstanceState
) {
  let isSyncEnabled = $state(false);
  let leaderCharacterId = $state<"character1" | "character2">("character1");
  let stepOffset = $state(0);

  // Track the previous leader beat to detect changes.
  let previousLeaderStep = -1;

  // Cleanup function for effect root
  let cleanupEffects: (() => void) | null = null;

  function getLeader() {
    return leaderCharacterId === "character1" ? character1 : character2;
  }

  function getFollower() {
    return leaderCharacterId === "character1" ? character2 : character1;
  }

  function calculateFollowerBeat(
    leaderStep: number,
    totalSteps: number
  ): number {
    if (totalSteps === 0) return 0;
    // Add offset and wrap using modulo (handles negatives correctly)
    const result =
      (((leaderStep + stepOffset) % totalSteps) + totalSteps) % totalSteps;
    return result;
  }

  /**
   * Sync the follower to the leader's current beat with an offset.
   */
  function syncFollowerStep() {
    if (!isSyncEnabled) return;
    const leader = getLeader();
    const follower = getFollower();
    if (!leader.hasSequence || !follower.hasSequence) return;

    const followerBeat = calculateFollowerBeat(
      leader.currentStepIndex,
      follower.totalSteps
    );
    follower.goToStep(followerBeat);
  }

  /**
   * Sync follower playback state to the leader.
   */
  function syncFollowerPlayback() {
    if (!isSyncEnabled) return;
    const leader = getLeader();
    const follower = getFollower();

    if (leader.isPlaying && !follower.isPlaying) {
      follower.play();
    } else if (!leader.isPlaying && follower.isPlaying) {
      follower.pause();
    }
  }

  // Create effects in a root scope (allows creation outside component init)
  cleanupEffects = $effect.root(() => {
    // Watch the leader's beat changes and sync the follower.
    $effect(() => {
      if (!isSyncEnabled) return;

      const leader = getLeader();
      const currentLeaderBeat = leader.currentStepIndex;

      // Only sync when beat actually changes
      if (currentLeaderBeat !== previousLeaderStep) {
        previousLeaderStep = currentLeaderBeat;
        syncFollowerStep();
      }
    });

    // Watch the leader's playing state and sync the follower.
    $effect(() => {
      if (!isSyncEnabled) return;

      const leader = getLeader();
      // Access isPlaying to establish dependency
      const _playing = leader.isPlaying;
      syncFollowerPlayback();
    });

    // When sync is enabled, immediately sync state
    $effect(() => {
      if (isSyncEnabled) {
        const leader = getLeader();
        previousLeaderStep = leader.currentStepIndex;
        syncFollowerStep();
        syncFollowerPlayback();
      }
    });
  });

  /**
   * Toggle sync on/off
   */
  function toggleSync() {
    isSyncEnabled = !isSyncEnabled;
    if (isSyncEnabled) {
      // Sync immediately when enabled
      const leader = getLeader();
      previousLeaderStep = leader.currentStepIndex;
      syncFollowerStep();
      syncFollowerPlayback();
    }
  }

  /**
   * Set beat offset (-8 to +8)
   */
  function setOffset(offset: number) {
    stepOffset = Math.max(MIN_OFFSET, Math.min(MAX_OFFSET, offset));
    if (isSyncEnabled) {
      syncFollowerStep();
    }
  }

  /**
   * Increment offset by 1
   */
  function incrementOffset() {
    setOffset(stepOffset + 1);
  }

  /**
   * Decrement offset by 1
   */
  function decrementOffset() {
    setOffset(stepOffset - 1);
  }

  /**
   * Swap which character leads.
   */
  function swapLeader() {
    leaderCharacterId =
      leaderCharacterId === "character1" ? "character2" : "character1";
    previousLeaderStep = -1;
    if (isSyncEnabled) {
      syncFollowerStep();
      syncFollowerPlayback();
    }
  }

  function getOffsetDescription(): string {
    const followerName =
      leaderCharacterId === "character1" ? "Character 2" : "Character 1";
    if (stepOffset === 0) {
      return `${followerName} is in sync`;
    } else if (stepOffset > 0) {
      return `${followerName} is ${stepOffset} step${stepOffset !== 1 ? "s" : ""} ahead`;
    } else {
      const absOffset = Math.abs(stepOffset);
      return `${followerName} is ${absOffset} step${absOffset !== 1 ? "s" : ""} behind`;
    }
  }

  /**
   * Cleanup effects when no longer needed
   */
  function destroy() {
    if (cleanupEffects) {
      cleanupEffects();
      cleanupEffects = null;
    }
  }

  return {
    // Config getters
    get isSyncEnabled() {
      return isSyncEnabled;
    },
    get leaderCharacterId() {
      return leaderCharacterId;
    },
    get stepOffset() {
      return stepOffset;
    },

    // Derived state
    get leader() {
      return getLeader();
    },
    get follower() {
      return getFollower();
    },
    get offsetDescription() {
      return getOffsetDescription();
    },

    // Constants
    minOffset: MIN_OFFSET,
    maxOffset: MAX_OFFSET,

    // Actions
    toggleSync,
    setOffset,
    incrementOffset,
    decrementOffset,
    swapLeader,
    destroy,
  };
}

export type CharacterSyncState = ReturnType<typeof createCharacterSyncState>;
