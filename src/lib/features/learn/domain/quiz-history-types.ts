/**
 * Types for quiz history tracking and concept mastery analysis.
 *
 * QuizAttempt is the raw record stored per quiz completion.
 * ConceptMastery is the computed summary derived from attempts.
 */

/**
 * A single quiz attempt recorded to Firestore.
 * Append-only: never updated after creation.
 */
export interface QuizAttempt {
  /** Firestore document ID */
  id: string;

  /** Which concept this quiz tested */
  conceptId: string;

  /** Quiz format (e.g. "pictograph-to-letter", "letter-to-pictograph") */
  quizType: string;

  /** Score as percentage (0-100) */
  score: number;

  /** Number of correct answers */
  correctCount: number;

  /** Total questions in this attempt */
  totalCount: number;

  /** Time spent on this attempt in seconds */
  timeSpentSeconds: number;

  /** When this attempt was recorded */
  timestamp: Date;

  /** Wrong answer details for gap detection (only present if there were wrong answers) */
  wrongAnswers?: WrongAnswerRecord[];
}

/**
 * A single wrong answer within a quiz attempt.
 * Stores enough context to identify misconception patterns.
 */
export interface WrongAnswerRecord {
  /** What the user selected */
  selectedContent: unknown;
  /** What the correct answer was */
  correctContent: unknown;
  /** Which quiz format this came from */
  quizType: string;
  /** When the answer was given */
  answeredAt: string;
}

/**
 * Serializable version of QuizAttempt for Firestore storage.
 * Dates are stored as ISO strings.
 */
export interface QuizAttemptFirestore {
  id: string;
  conceptId: string;
  quizType: string;
  score: number;
  correctCount: number;
  totalCount: number;
  timeSpentSeconds: number;
  timestamp: string;
  wrongAnswers?: WrongAnswerRecord[];
}

/**
 * Computed mastery summary for a single concept.
 * Derived from the user's quiz attempt history.
 */
export interface ConceptMastery {
  /** Which concept this mastery applies to */
  conceptId: string;

  /** Total quiz attempts on this concept */
  attempts: number;

  /** Average score across all attempts (0-100) */
  averageScore: number;

  /** Most recent score (0-100) */
  lastScore: number;

  /** Score trend based on recent attempts */
  trend: "improving" | "stable" | "declining";

  /**
   * Whether the user has mastered this concept. Mastery means
   * `averageScore >= LearnModuleConfig.masteryThreshold` and
   * `attempts >= LearnModuleConfig.completionRequirement`. Read the thresholds
   * from the config rather than hardcoding them so callers stay in sync.
   */
  mastered: boolean;

  /** When the user last attempted a quiz on this concept */
  lastAttemptAt: Date;
}

/**
 * Summary of mastery data formatted for the TIKA system prompt.
 * Lightweight representation to minimize token usage.
 */
export interface MasteryContext {
  /** Concept IDs the user has mastered (avg score >= 80%) */
  masteredConcepts: string[];

  /** Concept IDs where the user is struggling (avg score < 60%) */
  strugglingConcepts: string[];

  /** Recommended next concepts based on prerequisite graph */
  suggestedNext: string[];

  /** Concepts due for spaced repetition review */
  dueForReview: string[];

  /** Active misconceptions detected from quiz wrong answers */
  activeMisconceptions?: MisconceptionSummary[];
}

/**
 * A misconception pair surfaced to TIKA for proactive teaching.
 */
export interface MisconceptionSummary {
  /** First concept node in the confusion pair */
  nodeA: string;
  /** Second concept node in the confusion pair */
  nodeB: string;
  /** How many times the user has confused these */
  occurrenceCount: number;
  /** Explanation from the knowledge graph */
  explanation?: string;
}
