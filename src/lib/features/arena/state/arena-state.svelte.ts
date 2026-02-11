/**
 * Arena State
 *
 * Reactive state for the Arena module using Svelte 5 runes.
 * Manages current matchup, session stats, and UI loading states.
 */

import type {
  ArenaMatchup,
  ArenaLeaderboardEntry,
  ArenaUserStats,
} from "../domain/models/arena-models";

class ArenaState {
  currentMatchup = $state<ArenaMatchup | null>(null);
  isLoading = $state(true);
  isVoting = $state(false);
  /** Which side just won (for vote animation). Null when no animation playing. */
  voteResult = $state<"left" | "right" | null>(null);
  sessionStreak = $state(0);
  matchupsCompleted = $state(0);
  leaderboard = $state<ArenaLeaderboardEntry[]>([]);
  userStats = $state<ArenaUserStats | null>(null);
  /** Error message for display */
  error = $state<string | null>(null);
}

export const arenaState = new ArenaState();
