/**
 * Learn Domain Models
 *
 * TypeScript interfaces for the learn module data structures.
 */

import type {
  QuizAnswerFeedback,
  QuizAnswerFormat,
  QuizMode,
  QuizQuestionFormat,
  QuizType,
  QuizView,
} from "../enums/quiz-enums";
import type { LetterCategory } from "../../../codex/domain/types/codex-types";

/**
 * Config data for a lesson type.
 * Contains all static configuration needed to set up and run a lesson.
 */
export interface QuizConfig {
  lessonType: QuizType;
  questionFormat: QuizQuestionFormat;
  answerFormat: QuizAnswerFormat;
  quizDescription: string;
  questionPrompt: string;
}

/**
 * Lesson information for display in the lesson selector.
 */
export interface QuizInfo {
  name: string;
  description: string;
  lessonType: QuizType;
}

/**
 * Represents a quiz question with content and answer options.
 */
export interface QuizQuestionData {
  questionId: string;
  questionContent: unknown; // Pictograph data, letter string, or text
  answerOptions: QuizAnswerOption[]; // Array of answer choices
  correctAnswer: unknown; // The correct answer from the options
  questionType: QuizQuestionFormat;
  answerType: QuizAnswerFormat;
  lessonType: QuizType;
  generationTimestamp?: string;
  difficultyLevel?: number;
}

/**
 * Answer option for quiz questions.
 */
export interface QuizAnswerOption {
  id: string;
  content: unknown; // Letter string, pictograph data, etc.
  isCorrect: boolean;
  feedback?: string;
}

/**
 * Timer state for countdown mode.
 */
export interface QuizTimerState {
  timeRemaining: number; // seconds
  isRunning: boolean;
  isPaused: boolean;
  totalTime: number; // initial time in seconds
}

/**
 * Progress tracking for lessons.
 */
export interface QuizProgress {
  currentQuestion: number;
  totalQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  questionsAnswered: number;
  timeElapsed: number; // seconds
  streakCurrent: number;
  streakLongest: number;
}

/**
 * Represents an active quiz session with state and progress tracking.
 */
export interface QuizSession {
  sessionId: string;
  lessonType: QuizType | null;
  quizMode: QuizMode | null;
  currentQuestion: number;
  totalQuestions: number;
  questionsAnswered: number;
  correctAnswers: number;
  incorrectGuesses: number;
  quizTime: number; // seconds remaining for countdown mode
  startTime: Date;
  lastInteraction: Date;
  isActive: boolean;
  isCompleted: boolean;
  // Streak tracking within this session
  currentStreak: number; // Consecutive correct answers right now
  longestStreak: number; // Best streak achieved in this session
}

/**
 * Represents the final results and statistics for a completed lesson.
 */
export interface QuizResults {
  sessionId: string;
  lessonType: QuizType;
  quizMode: QuizMode;
  totalQuestions: number;
  correctAnswers: number;
  incorrectGuesses: number;
  questionsAnswered: number;
  accuracyPercentage: number;
  completionTimeSeconds: number;
  completedAt: Date;
  averageTimePerQuestion?: number;
  streakLongestCorrect?: number;
}

/**
 * State for the learn tab.
 */
export interface QuizState {
  currentView: QuizView;
  selectedMode: QuizMode;
  activeSession: QuizSession | null;
  isLoading: boolean;
  error: string | null;
}
export interface QuizConfig {
  id?: string; // Added for QuizRepoManager usage
  type: string;
  name: string;
  description: string;
  includedCategories: LetterCategory[];
  includedLetters?: string[];
  excludedLetters?: string[];
  categories?: LetterCategory[]; // Added for QuizRepoManager usage
  letters?: string[]; // Added for QuizRepoManager usage
  difficulty?: number; // Added for QuizRepoManager usage
}

export interface QuizAnswerResult {
  isCorrect: boolean;
  feedback: QuizAnswerFeedback;
  message: string;
  correctAnswer?: unknown;
  explanation?: string;
}
