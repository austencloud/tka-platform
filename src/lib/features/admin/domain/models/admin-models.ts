/**
 * Admin Domain Models
 *
 * Data models for admin functionality
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type {
  DailyChallenge,
  ChallengeDifficulty,
  ChallengeType,
} from "$lib/shared/gamification/domain/models/achievement-models";

/**
 * Challenge schedule entry
 */
export interface ChallengeScheduleEntry {
  date: string; // YYYY-MM-DD format
  challenge: DailyChallenge | null;
  isScheduled: boolean;
}

/**
 * Sequence selection for challenge creation
 */
export interface SequenceSelection {
  sequence: SequenceData;
  selected: boolean;
}

/**
 * Challenge creation form data
 */
export interface ChallengeFormData {
  date: string;
  sequenceId?: string;
  title: string;
  description: string;
  difficulty: ChallengeDifficulty;
  xpReward: number;
  type: ChallengeType;
  target: number;
  metadata?: Record<string, unknown>;
}
