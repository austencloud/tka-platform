/**
 * Quiz Results Analyzer
 *
 * Consolidated service for analyzing and presenting quiz results.
 * Combines grading, feedback, achievements, and formatting functionality.
 */

import type { QuizResults } from "./domain/models/quiz-models";
import { QuizMode, QuizType } from "./domain/enums/quiz-enums";

// ============================================================================
// Types
// ============================================================================

export interface PerformanceGrade {
  grade: string;
  color: string;
  message: string;
}

// ============================================================================
// Interface
// ============================================================================

export interface IQuizResultsAnalyzer {
  // Grading
  getPerformanceGrade(accuracy: number): PerformanceGrade;
  isPassingGrade(accuracy: number): boolean;
  isExcellentGrade(accuracy: number): boolean;
  isPerfectScore(accuracy: number): boolean;

  // Feedback
  getPerformanceFeedback(results: QuizResults): string;
  getEncouragementMessage(accuracy: number): string;

  // Achievements
  getAchievements(results: QuizResults): string[];
  hasAchievement(results: QuizResults, achievementName: string): boolean;

  // Formatting
  formatTime(seconds: number): string;
  formatAccuracy(accuracy: number): string;
  formatDate(date: Date): string;
  getLessonDisplayName(lessonType: QuizType | undefined): string;
  getQuizModeDisplayName(quizMode: QuizMode | undefined): string;
}

// ============================================================================
// Implementation
// ============================================================================

export class QuizResultsAnalyzer implements IQuizResultsAnalyzer {
  // ==========================================================================
  // Grading
  // ==========================================================================

  getPerformanceGrade(accuracy: number): PerformanceGrade {
    if (accuracy >= 90) {
      return { grade: "A", color: "#10b981", message: "Excellent!" };
    }
    if (accuracy >= 80) {
      return { grade: "B", color: "#3b82f6", message: "Great job!" };
    }
    if (accuracy >= 70) {
      return { grade: "C", color: "#f59e0b", message: "Good work!" };
    }
    if (accuracy >= 60) {
      return { grade: "D", color: "#ef4444", message: "Keep practicing!" };
    }
    return { grade: "F", color: "#dc2626", message: "Try again!" };
  }

  isPassingGrade(accuracy: number): boolean {
    return accuracy >= 70;
  }

  isExcellentGrade(accuracy: number): boolean {
    return accuracy >= 90;
  }

  isPerfectScore(accuracy: number): boolean {
    return accuracy === 100;
  }

  // ==========================================================================
  // Feedback
  // ==========================================================================

  getPerformanceFeedback(results: QuizResults): string {
    const accuracy = results.accuracyPercentage;
    const avgTime = results.averageTimePerQuestion ?? 0;

    if (accuracy >= 90) {
      if (avgTime < 3) {
        return "Outstanding! You're both accurate and fast.";
      } else {
        return "Excellent accuracy! You really understand this lesson.";
      }
    } else if (accuracy >= 70) {
      return "Good progress! Keep practicing to improve your speed and accuracy.";
    } else {
      return "Don't give up! Review the lesson materials and try again.";
    }
  }

  getEncouragementMessage(accuracy: number): string {
    if (accuracy >= 90) return "Keep up the amazing work!";
    if (accuracy >= 70) return "You're making great progress!";
    if (accuracy >= 50) return "Practice makes perfect!";
    return "Every attempt brings you closer to mastery!";
  }

  // ==========================================================================
  // Achievements
  // ==========================================================================

  getAchievements(results: QuizResults): string[] {
    const achievements: string[] = [];

    // Perfect score achievement
    if (results.accuracyPercentage === 100) {
      achievements.push("🎯 Perfect Score");
    }

    // High achiever (90%+)
    if (results.accuracyPercentage >= 90) {
      achievements.push("⭐ High Achiever");
    }

    // Speed demon (avg < 3 seconds)
    if (results.averageTimePerQuestion && results.averageTimePerQuestion < 3) {
      achievements.push("⚡ Speed Demon");
    }

    // Hot streak (5+ correct in a row)
    if (results.streakLongestCorrect && results.streakLongestCorrect >= 5) {
      achievements.push("🔥 Hot Streak");
    }

    // Quick learner (completed in under 1 minute)
    if (results.completionTimeSeconds < 60) {
      achievements.push("🏃 Quick Learner");
    }

    // Perfectionist (no wrong answers)
    if (results.incorrectGuesses === 0 && results.correctAnswers > 0) {
      achievements.push("💎 Perfectionist");
    }

    // Marathon runner (10+ questions)
    if (results.totalQuestions >= 10) {
      achievements.push("🏅 Marathon Runner");
    }

    return achievements;
  }

  hasAchievement(results: QuizResults, achievementName: string): boolean {
    return this.getAchievements(results).includes(achievementName);
  }

  // ==========================================================================
  // Formatting
  // ==========================================================================

  formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  }

  getLessonDisplayName(lessonType: QuizType | undefined): string {
    if (!lessonType) return "Unknown Quiz";

    switch (lessonType) {
      case QuizType.PICTOGRAPH_TO_LETTER:
        return "Quiz 1: Pictograph to Letter";
      case QuizType.LETTER_TO_PICTOGRAPH:
        return "Quiz 2: Letter to Pictograph";
      case QuizType.VALID_NEXT_PICTOGRAPH:
        return "Quiz 3: Valid Next Pictograph";
      default:
        return "Unknown Quiz";
    }
  }

  getQuizModeDisplayName(quizMode: QuizMode | undefined): string {
    if (!quizMode) return "Unknown Mode";

    switch (quizMode) {
      case QuizMode.FIXED_QUESTION:
        return "Fixed Questions";
      case QuizMode.COUNTDOWN:
        return "Countdown";
      default:
        return "Unknown Mode";
    }
  }

  formatAccuracy(accuracy: number): string {
    return `${accuracy.toFixed(1)}%`;
  }

  formatDate(date: Date): string {
    return date.toLocaleDateString();
  }
}
