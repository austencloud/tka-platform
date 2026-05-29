/**
 * Quiz Session Service
 *
 * Manages quiz sessions, progress tracking, and session state.
 * Handles both fixed question and countdown quiz modes.
 */

import { QuizMode, QuizType } from "../domain/enums/quiz-enums";
import {
  type QuizProgress,
  type QuizResults,
  type QuizSession,
  type QuizTimerState,
} from "../domain/models/quiz-models";
import { getTotalQuestions, getQuizTime } from "./quiz-configurator";

export class QuizSessionManager {
  private activeSessions: Map<string, QuizSession> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private currentSessionId: string | null = null;

  /**
   * Create a new quiz session.
   */
  createSession(lessonType: QuizType, quizMode: QuizMode): string {
    const sessionId = this.generateSessionId();
    const totalQuestions = getTotalQuestions(quizMode);
    const quizTime = getQuizTime(quizMode);

    const session: QuizSession = {
      sessionId,
      lessonType,
      quizMode,
      currentQuestion: 1,
      totalQuestions,
      questionsAnswered: 0,
      correctAnswers: 0,
      incorrectGuesses: 0,
      quizTime,
      startTime: new Date(),
      lastInteraction: new Date(),
      isActive: true,
      isCompleted: false,
      currentStreak: 0,
      longestStreak: 0,
    };

    this.activeSessions.set(sessionId, session);
    return sessionId;
  }

  /**
   * Get an active session.
   */
  getSession(sessionId: string): QuizSession | null {
    return this.activeSessions.get(sessionId) || null;
  }

  /**
   * Update session progress.
   */
  updateSessionProgress(
    sessionId: string,
    isCorrect: boolean,
    timeElapsed?: number
  ): QuizSession | null {
    const session = this.getSession(sessionId);
    if (!session?.isActive) {
      return null;
    }

    // Update progress
    session.questionsAnswered++;
    if (isCorrect) {
      session.correctAnswers++;
      // Update streak tracking
      session.currentStreak++;
      if (session.currentStreak > session.longestStreak) {
        session.longestStreak = session.currentStreak;
      }
    } else {
      session.incorrectGuesses++;
      // Reset current streak on incorrect answer
      session.currentStreak = 0;
    }

    // Update timing
    session.lastInteraction = new Date();
    if (timeElapsed !== undefined && session.quizMode === QuizMode.COUNTDOWN) {
      session.quizTime = Math.max(0, session.quizTime - timeElapsed);
    }

    // Move to next question for fixed question mode
    if (session.quizMode === QuizMode.FIXED_QUESTION) {
      session.currentQuestion++;
    }

    // Check completion conditions
    this.checkSessionCompletion(sessionId);

    return session;
  }

  /**
   * Check if session should be completed.
   */
  private checkSessionCompletion(sessionId: string): void {
    const session = this.getSession(sessionId);
    if (!session) return;

    let shouldComplete = false;

    if (session.quizMode === QuizMode.FIXED_QUESTION) {
      // Complete when all questions are answered
      shouldComplete = session.questionsAnswered >= session.totalQuestions;
    } else if (session.quizMode === QuizMode.COUNTDOWN) {
      // Complete when time runs out
      shouldComplete = session.quizTime <= 0;
    }

    if (shouldComplete) {
      this.completeSession(sessionId);
    }
  }

  /**
   * Complete a quiz session.
   */
  completeSession(sessionId: string): QuizResults | null {
    const session = this.getSession(sessionId);
    if (!session) return null;

    session.isActive = false;
    session.isCompleted = true;

    // Stop any running timers
    this.stopTimer(sessionId);

    // Calculate results
    const results = this.calculateResults(session);

    // Clean up session
    this.activeSessions.delete(sessionId);

    return results;
  }

  /**
   * Calculate lesson results from session.
   */
  private calculateResults(session: QuizSession): QuizResults {
    if (!session.lessonType || !session.quizMode) {
      throw new Error(
        "Session must have lessonType and quizMode to calculate results"
      );
    }

    const completionTime =
      (new Date().getTime() - session.startTime.getTime()) / 1000;
    const accuracyPercentage =
      session.questionsAnswered > 0
        ? (session.correctAnswers / session.questionsAnswered) * 100
        : 0;
    const averageTimePerQuestion =
      session.questionsAnswered > 0
        ? completionTime / session.questionsAnswered
        : 0;

    return {
      sessionId: session.sessionId,
      lessonType: session.lessonType,
      quizMode: session.quizMode,
      totalQuestions: session.totalQuestions,
      correctAnswers: session.correctAnswers,
      incorrectGuesses: session.incorrectGuesses,
      questionsAnswered: session.questionsAnswered,
      accuracyPercentage: Math.round(accuracyPercentage * 100) / 100,
      completionTimeSeconds: Math.round(completionTime),
      completedAt: new Date(),
      averageTimePerQuestion: Math.round(averageTimePerQuestion * 100) / 100,
      streakLongestCorrect: session.longestStreak,
    };
  }

  /**
   * Get current lesson progress.
   */
  getLessonProgress(sessionId: string): QuizProgress | null {
    const session = this.getSession(sessionId);
    if (!session) return null;

    const timeElapsed =
      (new Date().getTime() - session.startTime.getTime()) / 1000;

    return {
      currentQuestion: session.currentQuestion,
      totalQuestions: session.totalQuestions,
      correctAnswers: session.correctAnswers,
      incorrectAnswers: session.incorrectGuesses,
      questionsAnswered: session.questionsAnswered,
      timeElapsed: Math.round(timeElapsed),
      streakCurrent: session.currentStreak,
      streakLongest: session.longestStreak,
    };
  }

  /**
   * Start countdown timer for a session.
   */
  startTimer(
    sessionId: string,
    onTick?: (timeRemaining: number) => void
  ): void {
    const session = this.getSession(sessionId);
    if (session?.quizMode !== QuizMode.COUNTDOWN) return;

    // Clear existing timer
    this.stopTimer(sessionId);

    const timer = setInterval(() => {
      const currentSession = this.getSession(sessionId);
      if (!currentSession?.isActive) {
        this.stopTimer(sessionId);
        return;
      }

      currentSession.quizTime = Math.max(0, currentSession.quizTime - 1);
      onTick?.(currentSession.quizTime);

      if (currentSession.quizTime <= 0) {
        this.completeSession(sessionId);
      }
    }, 1000);

    this.timers.set(sessionId, timer);
  }

  /**
   * Stop timer for a session.
   */
  stopTimer(sessionId: string): void {
    const timer = this.timers.get(sessionId);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(sessionId);
    }
  }

  /**
   * Pause/resume timer for a session.
   */
  pauseTimer(sessionId: string): void {
    this.stopTimer(sessionId);
  }

  /**
   * Get timer state for a session.
   */
  getTimerState(sessionId: string): QuizTimerState | null {
    const session = this.getSession(sessionId);
    if (!session?.quizMode) return null;

    const isRunning = this.timers.has(sessionId);
    const totalTime = getQuizTime(session.quizMode);

    return {
      timeRemaining: session.quizTime,
      isRunning,
      isPaused: !isRunning && session.isActive,
      totalTime,
    };
  }

  /**
   * Abandon a session.
   */
  abandonSession(sessionId: string): void {
    this.stopTimer(sessionId);
    this.activeSessions.delete(sessionId);
  }

  /**
   * Get all active sessions.
   */
  getActiveSessions(): QuizSession[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Clean up expired sessions.
   */
  cleanupExpiredSessions(maxAgeMinutes: number = 30): void {
    const now = new Date();
    const maxAge = maxAgeMinutes * 60 * 1000;

    for (const [sessionId, session] of this.activeSessions.entries()) {
      const age = now.getTime() - session.lastInteraction.getTime();
      if (age > maxAge) {
        this.abandonSession(sessionId);
      }
    }
  }

  /**
   * Generate unique session ID.
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Format time for display (MM:SS).
   */
  formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  }

  /**
   * Get session statistics.
   */
  getSessionStats(): {
    totalSessions: number;
    activeSessions: number;
    completedSessions: number;
  } {
    const activeSessions = this.activeSessions.size;
    // Note: We don't track completed sessions in this simple implementation
    // In a real app, you'd want to persist this data

    return {
      totalSessions: activeSessions, // This would be total from database
      activeSessions,
      completedSessions: 0, // This would be from database
    };
  }

  /**
   * Start a new quiz session
   */
  startQuiz(lessonId: string): void {
    // For now, create a simple session - in a real implementation,
    // you'd load lesson config and set up properly
    this.currentSessionId = this.createSession(
      lessonId as QuizType,
      QuizMode.FIXED_QUESTION
    );
  }

  /**
   * Get the current active session
   */
  getCurrentSession(): QuizSession | null {
    if (!this.currentSessionId) return null;
    return this.getSession(this.currentSessionId);
  }

  /**
   * Submit an answer for the current question
   */
  submitAnswer(_answer: unknown): boolean {
    if (!this.currentSessionId) return false;

    // For now, randomly determine if answer is correct
    // In a real implementation, you'd validate against the correct answer
    const isCorrect = Math.random() > 0.5;

    this.updateSessionProgress(this.currentSessionId, isCorrect);
    return isCorrect;
  }

  /**
   * Complete the current quiz
   */
  completeQuiz(): QuizResults | null {
    if (!this.currentSessionId) return null;

    const results = this.completeSession(this.currentSessionId);
    this.currentSessionId = null;
    return results;
  }

  /**
   * Restart the current quiz
   */
  restartQuiz(): void {
    if (this.currentSessionId) {
      this.abandonSession(this.currentSessionId);
    }

    // Create a new session with the same parameters
    // In a real implementation, you'd preserve the lesson type and mode
    this.currentSessionId = this.createSession(
      QuizType.PICTOGRAPH_TO_LETTER,
      QuizMode.FIXED_QUESTION
    );
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    if (this.currentSessionId) {
      this.abandonSession(this.currentSessionId);
      this.currentSessionId = null;
    }
  }
}
