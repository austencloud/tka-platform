/**
 * Quiz Session Interface
 *
 * Interface for managing quiz sessions, progress tracking, and session state.
 */

import type { QuizMode, QuizType } from "../../domain/enums/quiz-enums";
import type { QuizResults, QuizSession } from "../../domain/models/quiz-models";

export interface IQuizSessionManager {
  /**
   * Start a new quiz session
   */
  startQuiz(lessonId: string): void;

  /**
   * Get the current active session
   */
  getCurrentSession(): QuizSession | null;

  /**
   * Submit an answer for the current question
   */
  submitAnswer(answer: unknown): boolean;

  /**
   * Complete the current quiz
   */
  completeQuiz(): QuizResults | null;

  /**
   * Restart the current quiz
   */
  restartQuiz(): void;

  /**
   * Clean up resources
   */
  cleanup(): void;

  /**
   * Create a new quiz session
   */
  createSession(lessonType: QuizType, quizMode: QuizMode): string;

  /**
   * Get session by ID
   */
  getSession(sessionId: string): QuizSession | null;

  /**
   * Update session progress
   */
  updateSessionProgress(
    sessionId: string,
    isCorrect: boolean,
    timeElapsed?: number
  ): QuizSession | null;

  /**
   * Complete a session
   */
  completeSession(sessionId: string): QuizResults | null;

  /**
   * Abandon a session
   */
  abandonSession(sessionId: string): void;
}
