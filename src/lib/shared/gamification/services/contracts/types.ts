/**
 * Action types that can contribute to skill progress
 */
export type SkillProgressActionType =
  | "sequence_created"
  | "sequence_with_letter"
  | "drill_completed"
  | "quiz_completed"
  | "daily_practice"
  | "challenge_completed"
  | "exploration_complete";

/**
 * Metadata for skill progress tracking
 */
export interface SkillProgressMetadata {
  letter?: string; // For letter-specific actions
  conceptId?: string; // For concept-specific actions
  quizScore?: number; // Score from 0-100
  practiceMinutes?: number; // Duration of practice
  sequenceId?: string; // Created sequence
  challengeType?: "daily" | "weekly";
  [key: string]: unknown;
}
