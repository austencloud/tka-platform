/**
 * ITikaInteractionTracker - Contract for tracking TIKA topic interactions
 *
 * Records what topics users have discussed with TIKA and their quiz performance.
 * Persists to Firestore for cross-session awareness.
 */

export interface TikaTopicInteraction {
  /** Normalized topic identifier (e.g., "letter-A", "position-alpha", "type-1") */
  topic: string;

  /** How many times this topic has been discussed */
  interactionCount: number;

  /** When this topic was last discussed */
  lastDiscussed: Date;

  /** Number of quiz attempts on this topic via TIKA inline quizzes */
  quizAttempts: number;

  /** Ratio of correct answers (0-1), or 0 if no attempts */
  quizCorrectRate: number;
}

export interface ITikaInteractionTracker {
  /**
   * Record that a topic was discussed in a TIKA conversation.
   * Atomically increments the interaction count for the topic.
   */
  recordTopicDiscussion(userId: string, topic: string): Promise<void>;

  /**
   * Record a quiz result from an inline TIKA quiz.
   * Updates quiz stats and delegates to QuizHistoryRecorder for mastery tracking.
   */
  recordQuizResult(
    userId: string,
    topic: string,
    correct: boolean,
    quizType: string
  ): Promise<void>;

  /**
   * Get the user's topic interaction history, sorted by most recent.
   */
  getTopicHistory(
    userId: string,
    limit?: number
  ): Promise<TikaTopicInteraction[]>;
}
