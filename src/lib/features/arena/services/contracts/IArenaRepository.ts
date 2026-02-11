/**
 * IArenaRepository
 *
 * Firestore CRUD for arenaRatings, arenaVotes, and arenaSnapshots.
 */

import type {
  ArenaEntry,
  ArenaRating,
  ArenaVote,
  ArenaLeaderboardEntry,
  ArenaUserStats,
} from "../../domain/models/arena-models";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { MatchupCandidate } from "./IMatchupSelector";

export interface IArenaRepository {
  /**
   * Load the full pool of arena-eligible entries with their ratings.
   * Creates default ratings for entries that don't have one yet.
   */
  loadPool(): Promise<MatchupCandidate[]>;

  /** Get a single rating by entry ID. Returns null if not rated yet. */
  getRating(entryId: string): Promise<ArenaRating | null>;

  /** Write updated ratings for both sides of a matchup. Atomic batch write. */
  saveRatings(winner: ArenaRating, loser: ArenaRating): Promise<void>;

  /** Record a vote. */
  saveVote(vote: ArenaVote): Promise<void>;

  /** Load the leaderboard (top N entries by displayRating, descending). */
  loadLeaderboard(limit: number): Promise<ArenaLeaderboardEntry[]>;

  /** Load a voter's stats. */
  loadUserStats(userId: string): Promise<ArenaUserStats>;

  /** Load a voter's recent votes (for dedup buffer). */
  loadRecentVotePairs(userId: string, limit: number): Promise<Set<string>>;

  /** Save daily rank snapshot for rank-change tracking. */
  saveDailySnapshot(entries: ArenaLeaderboardEntry[]): Promise<void>;

  /** Load yesterday's snapshot for rank-change computation. */
  loadPreviousSnapshot(): Promise<Map<string, number>>;
}
