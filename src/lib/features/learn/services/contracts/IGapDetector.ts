/**
 * Analyzes wrong quiz answers to detect misconception patterns.
 *
 * Uses the TKA knowledge graph to identify known confusion pairs
 * (e.g., Type 1 vs Type 3) and provides targeted explanations.
 */

import type { QuizAnswerEvent } from "../../quiz/domain/models/quiz-models";

/**
 * A detected gap from a single wrong answer.
 */
export interface DetectedGap {
  /** Knowledge graph node ID for the correct answer */
  correctNodeId: string;
  /** Knowledge graph node ID for what the user chose */
  chosenNodeId: string;
  /** Whether this pair is a known confusion in the knowledge graph */
  isKnownConfusion: boolean;
  /** Explanation from the knowledge graph (if known confusion) */
  confusionExplanation?: string;
  /** The correct letter or content label */
  correctLabel: string;
  /** The user's chosen letter or content label */
  chosenLabel: string;
}

/**
 * A recurring misconception pattern across multiple quiz attempts.
 */
export interface MisconceptionPattern {
  /** Knowledge graph node A in the confusion pair */
  nodeA: string;
  /** Knowledge graph node B in the confusion pair */
  nodeB: string;
  /** How many times this confusion has occurred */
  occurrenceCount: number;
  /** When it last happened */
  lastOccurredAt: Date;
  /** Explanation from the knowledge graph */
  explanation?: string;
}

export interface IGapDetector {
  /**
   * Analyze a single wrong answer synchronously.
   * Returns a DetectedGap if the error maps to the knowledge graph,
   * or null if it can't be classified.
   */
  detectSingleError(event: QuizAnswerEvent): DetectedGap | null;

  /**
   * Analyze a batch of wrong answers and return all detected gaps.
   */
  analyzeErrors(wrongAnswers: QuizAnswerEvent[]): DetectedGap[];

  /**
   * Query Firestore for recurring misconception patterns.
   */
  getRecurringMisconceptions(userId: string): Promise<MisconceptionPattern[]>;
}
