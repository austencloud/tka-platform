/**
 * IMatchupSelector
 *
 * Three-tier matchmaking:
 * 1. Cold-start pivot pairing (entries with < COLD_START_THRESHOLD matchups)
 * 2. UCB information-gain maximization (90% of remaining)
 * 3. Random exploration (10%)
 */

import type {
  ArenaEntry,
  ArenaRating,
  ArenaMatchup,
  MatchupReason,
} from "../../domain/models/arena-models";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

export interface MatchupCandidate {
  entry: ArenaEntry;
  rating: ArenaRating;
  data: SequenceData;
  /** Firestore path to the full sequence document (e.g., users/{uid}/sequences/{id}) */
  sourceRef?: string;
}

export interface IMatchupSelector {
  /**
   * Select the best matchup from a pool of candidates.
   * Excludes the current voter's own entries and recent matchup pairs.
   */
  selectMatchup(
    candidates: MatchupCandidate[],
    voterId: string,
    recentPairs: Set<string>
  ): { a: MatchupCandidate; b: MatchupCandidate; reason: MatchupReason } | null;
}
