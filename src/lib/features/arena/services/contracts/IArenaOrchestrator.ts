/**
 * IArenaOrchestrator
 *
 * Coordinates the arena flow:
 * load pool -> select matchup -> present -> record vote -> update ratings -> next matchup
 */

import type { ArenaMatchup, ArenaLeaderboardEntry, ArenaUserStats } from "../../domain/models/arena-models";

export interface IArenaOrchestrator {
  /** Initialize the arena: load pool, prepare first matchup */
  initialize(userId: string): Promise<void>;

  /** Get the current matchup to display */
  getCurrentMatchup(): ArenaMatchup | null;

  /** Record a vote: update ratings, prepare next matchup */
  vote(winnerId: string): Promise<void>;

  /** Skip current matchup without voting */
  skip(): Promise<void>;

  /** Load leaderboard data */
  loadLeaderboard(limit?: number): Promise<ArenaLeaderboardEntry[]>;

  /** Load the current user's stats */
  loadUserStats(): Promise<ArenaUserStats>;

  /** Whether the orchestrator is currently loading */
  isLoading(): boolean;

  /** Session streak count */
  getSessionStreak(): number;

  /** Total matchups completed this session */
  getMatchupsCompleted(): number;
}
