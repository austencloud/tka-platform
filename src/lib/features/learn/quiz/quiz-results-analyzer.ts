/**
 * Quiz Results Analyzer
 *
 * Consolidated module for analyzing and presenting quiz results.
 * Combines grading, feedback, achievements, and formatting functionality.
 */

import type { QuizResults } from "./domain/models/quiz-models";
import { QuizMode, QuizType } from "./domain/enums/quiz-enums";
import {
  QUIZ_ACHIEVEMENTS,
  type AchievementDefinition,
} from "./domain/achievement-definitions";

// ============================================================================
// Types
// ============================================================================

export interface PerformanceGrade {
  grade: string;
  color: string;
  message: string;
}

// ============================================================================
// Grading
// ============================================================================

export function getPerformanceGrade(accuracy: number): PerformanceGrade {
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

export function isPassingGrade(accuracy: number): boolean {
  return accuracy >= 70;
}

export function isExcellentGrade(accuracy: number): boolean {
  return accuracy >= 90;
}

export function isPerfectScore(accuracy: number): boolean {
  return accuracy === 100;
}

// ============================================================================
// Feedback
// ============================================================================

export function getPerformanceFeedback(results: QuizResults): string {
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

export function getEncouragementMessage(accuracy: number): string {
  if (accuracy >= 90) return "Keep up the amazing work!";
  if (accuracy >= 70) return "You're making great progress!";
  if (accuracy >= 50) return "Practice makes perfect!";
  return "Every attempt brings you closer to mastery!";
}

// ============================================================================
// Achievements
// ============================================================================

export function getAchievements(results: QuizResults): string[] {
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

export function hasAchievement(results: QuizResults, achievementName: string): boolean {
  return getAchievements(results).includes(achievementName);
}

/**
 * Get achievement definitions with tier information for animated display.
 */
export function getAchievementDefinitions(results: QuizResults): AchievementDefinition[] {
  const definitions: AchievementDefinition[] = [];

  // Perfect score (gold)
  if (results.accuracyPercentage === 100) {
    definitions.push(QUIZ_ACHIEVEMENTS["perfect-score"]!);
  }

  // Perfectionist (gold) - no wrong answers
  if (results.incorrectGuesses === 0 && results.correctAnswers > 0) {
    definitions.push(QUIZ_ACHIEVEMENTS["perfectionist"]!);
  }

  // High achiever (silver)
  if (results.accuracyPercentage >= 90 && results.accuracyPercentage < 100) {
    definitions.push(QUIZ_ACHIEVEMENTS["high-achiever"]!);
  }

  // Speed demon (silver)
  if (results.averageTimePerQuestion && results.averageTimePerQuestion < 3) {
    definitions.push(QUIZ_ACHIEVEMENTS["speed-demon"]!);
  }

  // Hot streak (silver)
  if (results.streakLongestCorrect && results.streakLongestCorrect >= 5) {
    definitions.push(QUIZ_ACHIEVEMENTS["hot-streak"]!);
  }

  // Quick learner (bronze)
  if (results.completionTimeSeconds < 60) {
    definitions.push(QUIZ_ACHIEVEMENTS["quick-learner"]!);
  }

  // Marathon runner (bronze)
  if (results.totalQuestions >= 10) {
    definitions.push(QUIZ_ACHIEVEMENTS["marathon-runner"]!);
  }

  return definitions;
}

// ============================================================================
// Formatting
// ============================================================================

export function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export function getLessonDisplayName(lessonType: QuizType | undefined): string {
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

export function getQuizModeDisplayName(quizMode: QuizMode | undefined): string {
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

export function formatAccuracy(accuracy: number): string {
  return `${accuracy.toFixed(1)}%`;
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString();
}
