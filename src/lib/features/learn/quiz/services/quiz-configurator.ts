/**
 * Lesson Config Service
 *
 * Manages lesson configurations, validation, and provides utilities
 * for working with different lesson types and quiz modes.
 */

import {
  LESSON_CONFIGS,
  LESSON_INFO,
  LESSON_TYPE_NAMES,
  QUIZ_DEFAULTS,
  QUIZ_MODE_NAMES,
} from "../domain/constants/quiz-constants";
import {
  QuizAnswerFormat,
  QuizMode,
  QuizQuestionFormat,
  QuizType,
} from "../domain/enums/quiz-enums";
import {
  type QuizConfig,
  type QuizInfo,
} from "../domain/models/quiz-models";

/**
 * Get configuration for a specific lesson type.
 */
export function getQuizConfig(lessonType: QuizType): QuizConfig {
  const config = LESSON_CONFIGS[lessonType];
  if (!config) {
    throw new Error(`No configuration found for lesson type: ${lessonType}`);
  }
  // Convert to domain QuizConfig format
  return {
    id: config.type,
    type: config.type,
    name: config.quizDescription,
    description: config.questionPrompt || "",
    includedCategories: [], // Default empty array
    lessonType: config.lessonType,
    questionFormat: config.questionFormat as QuizQuestionFormat,
    answerFormat: config.answerFormat as QuizAnswerFormat,
    quizDescription: config.quizDescription,
    questionPrompt: config.questionPrompt || "",
  };
}

/**
 * Get lesson information for display.
 */
export function getQuizInfo(lessonType: QuizType): QuizInfo {
  const info = LESSON_INFO.find((lesson) => lesson.lessonType === lessonType);
  if (!info) {
    throw new Error(`No lesson info found for lesson type: ${lessonType}`);
  }
  return info;
}

/**
 * Get all available lesson types.
 */
export function getAvailableQuizTypes(): QuizType[] {
  return Object.values(QuizType);
}

/**
 * Get all available quiz modes.
 */
export function getAvailableQuizModes(): QuizMode[] {
  return Object.values(QuizMode);
}

/**
 * Get display name for a lesson type.
 */
export function getQuizTypeName(lessonType: QuizType): string {
  return LESSON_TYPE_NAMES[lessonType] || lessonType;
}

/**
 * Get display name for a quiz mode.
 */
export function getQuizModeName(quizMode: QuizMode): string {
  return QUIZ_MODE_NAMES[quizMode] || quizMode;
}

/**
 * Get total questions for a quiz mode.
 */
export function getTotalQuestions(quizMode: QuizMode): number {
  switch (quizMode) {
    case QuizMode.FIXED_QUESTION:
      return QUIZ_DEFAULTS.FIXED_QUESTION_COUNT;
    case QuizMode.COUNTDOWN:
      return 0; // Unlimited questions in countdown mode
    default:
      return QUIZ_DEFAULTS.FIXED_QUESTION_COUNT;
  }
}

/**
 * Get quiz time for a quiz mode.
 */
export function getQuizTime(quizMode: QuizMode): number {
  switch (quizMode) {
    case QuizMode.COUNTDOWN:
      return QUIZ_DEFAULTS.COUNTDOWN_TIME_SECONDS;
    case QuizMode.FIXED_QUESTION:
      return 0; // No time limit for fixed question mode
    default: // QuizMode.FIXED_QUESTION
      return QUIZ_DEFAULTS.COUNTDOWN_TIME_SECONDS;
  }
}

/**
 * Validate lesson configuration.
 */
export function validateQuizConfig(config: QuizConfig): boolean {
  return (
    Object.values(QuizType).includes(config.lessonType) &&
    Object.values(QuizQuestionFormat).includes(config.questionFormat) &&
    Object.values(QuizAnswerFormat).includes(config.answerFormat) &&
    typeof config.quizDescription === "string" &&
    typeof config.questionPrompt === "string"
  );
}

/**
 * Check if a lesson type supports a specific question format.
 */
export function supportsQuestionFormat(
  lessonType: QuizType,
  format: QuizQuestionFormat
): boolean {
  const config = getQuizConfig(lessonType);
  return config.questionFormat === format;
}

/**
 * Check if a lesson type supports a specific answer format.
 */
export function supportsAnswerFormat(
  lessonType: QuizType,
  format: QuizAnswerFormat
): boolean {
  const config = getQuizConfig(lessonType);
  return config.answerFormat === format;
}

/**
 * Get quiz number from quiz type (for display purposes).
 */
export function getQuizNumber(quizType: QuizType): number {
  switch (quizType) {
    case QuizType.PICTOGRAPH_TO_LETTER:
      return 1;
    case QuizType.LETTER_TO_PICTOGRAPH:
      return 2;
    case QuizType.VALID_NEXT_PICTOGRAPH:
      return 3;
    case QuizType.SEQUENCE_TO_WORD:
      return 4;
    default:
      return 0;
  }
}

/**
 * Get quiz type from quiz number.
 */
export function getQuizTypeFromNumber(quizNumber: number): QuizType | null {
  switch (quizNumber) {
    case 1:
      return QuizType.PICTOGRAPH_TO_LETTER;
    case 2:
      return QuizType.LETTER_TO_PICTOGRAPH;
    case 3:
      return QuizType.VALID_NEXT_PICTOGRAPH;
    case 4:
      return QuizType.SEQUENCE_TO_WORD;
    default:
      return null;
  }
}

/**
 * Get formatted quiz title for display.
 */
export function getFormattedQuizTitle(quizType: QuizType): string {
  const quizNumber = getQuizNumber(quizType);
  const quizName = getQuizTypeName(quizType);
  return `Quiz ${quizNumber}: ${quizName}`;
}

/**
 * Get quiz description for display.
 */
export function getQuizDescription(quizType: QuizType): string {
  const info = getQuizInfo(quizType);
  return info.description;
}

/**
 * Check if a quiz is available (for future use with unlocking system).
 */
export function isQuizAvailable(_quizType: QuizType): boolean {
  // For now, all quizzes are available
  // This can be extended to support quiz unlocking logic
  return true;
}

/**
 * Get recommended quiz mode for a quiz type.
 */
export function getRecommendedQuizMode(quizType: QuizType): QuizMode {
  // For beginners, start with fixed questions
  // More advanced quizzes could default to countdown
  switch (quizType) {
    case QuizType.PICTOGRAPH_TO_LETTER:
      return QuizMode.FIXED_QUESTION;
    case QuizType.LETTER_TO_PICTOGRAPH:
      return QuizMode.FIXED_QUESTION;
    case QuizType.VALID_NEXT_PICTOGRAPH:
      return QuizMode.COUNTDOWN; // More challenging quiz
    case QuizType.SEQUENCE_TO_WORD:
      return QuizMode.FIXED_QUESTION;
    default:
      return QuizMode.FIXED_QUESTION;
  }
}

/**
 * Get difficulty level for a quiz type (1-5 scale).
 */
export function getDifficultyLevel(quizType: QuizType): number {
  switch (quizType) {
    case QuizType.PICTOGRAPH_TO_LETTER:
      return 1; // Easiest - just matching pictograph to letter
    case QuizType.LETTER_TO_PICTOGRAPH:
      return 2; // Medium - requires understanding pictograph structure
    case QuizType.VALID_NEXT_PICTOGRAPH:
      return 4; // Hardest - requires understanding flow and transitions
    case QuizType.SEQUENCE_TO_WORD:
      return 3;
    default:
      return 1;
  }
}

/**
 * Get estimated completion time for a quiz (in minutes).
 */
export function getEstimatedCompletionTime(
  quizType: QuizType,
  quizMode: QuizMode
): number {
  const baseTime = getDifficultyLevel(quizType) * 2; // 2 minutes per difficulty level

  switch (quizMode) {
    case QuizMode.FIXED_QUESTION:
      return baseTime + 5; // Add 5 minutes for fixed questions
    case QuizMode.COUNTDOWN:
      return 2; // Countdown mode is always 2 minutes
    default:
      return baseTime;
  }
}
