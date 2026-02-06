/**
 * Learn Domain Constants
 *
 * Config constants and static data for the learn module.
 */

// import type { QuizConfig, QuizInfo } from "../../../domain/models/QuizModels";

// Temporary interface definitions
interface QuizConfig {
  type: string;
  difficulty: string;
  timeLimit?: number;
  lessonType: QuizType;
  questionFormat: string;
  answerFormat: string;
  quizDescription: string;
  questionPrompt?: string;
}

interface QuizInfo {
  id: string;
  name: string;
  description: string;
  lessonType: QuizType;
}
import {
  QuizAnswerFormat,
  QuizMode,
  QuizQuestionFormat,
  QuizType,
} from "../enums/quiz-enums";

/**
 * Lesson configurations matching the desktop implementation.
 */
export const LESSON_CONFIGS: Record<QuizType, QuizConfig> = {
  [QuizType.PICTOGRAPH_TO_LETTER]: {
    type: "pictograph_to_letter",
    difficulty: "beginner",
    lessonType: QuizType.PICTOGRAPH_TO_LETTER,
    questionFormat: QuizQuestionFormat.PICTOGRAPH,
    answerFormat: QuizAnswerFormat.BUTTON,
    quizDescription: "pictograph_to_letter",
    questionPrompt: "Choose the letter for:",
  },
  [QuizType.LETTER_TO_PICTOGRAPH]: {
    type: "letter_to_pictograph",
    difficulty: "intermediate",
    lessonType: QuizType.LETTER_TO_PICTOGRAPH,
    questionFormat: QuizQuestionFormat.LETTER,
    answerFormat: QuizAnswerFormat.PICTOGRAPH,
    quizDescription: "letter_to_pictograph",
    questionPrompt: "Choose the pictograph for:",
  },
  [QuizType.VALID_NEXT_PICTOGRAPH]: {
    type: "valid_next_pictograph",
    difficulty: "advanced",
    lessonType: QuizType.VALID_NEXT_PICTOGRAPH,
    questionFormat: QuizQuestionFormat.PICTOGRAPH,
    answerFormat: QuizAnswerFormat.PICTOGRAPH,
    quizDescription: "valid_next_pictograph",
    questionPrompt: "Which pictograph can follow?",
  },
};

/**
 * Lesson information for display in the lesson selector.
 */
export const LESSON_INFO: QuizInfo[] = [
  {
    id: "lesson-1",
    name: "Quiz 1",
    description: "Match the correct letter to the given pictograph",
    lessonType: QuizType.PICTOGRAPH_TO_LETTER,
  },
  {
    id: "lesson-2",
    name: "Quiz 2",
    description: "Identify the correct pictograph for the displayed letter",
    lessonType: QuizType.LETTER_TO_PICTOGRAPH,
  },
  {
    id: "lesson-3",
    name: "Quiz 3",
    description: "Choose the pictograph that logically follows",
    lessonType: QuizType.VALID_NEXT_PICTOGRAPH,
  },
];

/**
 * Default quiz settings.
 */
export const QUIZ_DEFAULTS = {
  FIXED_QUESTION_COUNT: 20,
  COUNTDOWN_TIME_SECONDS: 120,
  ANSWER_OPTIONS_COUNT: 4,
} as const;

/**
 * Quiz mode display names.
 */
export const QUIZ_MODE_NAMES: Record<QuizMode, string> = {
  [QuizMode.FIXED_QUESTION]: "Fixed Questions",
  [QuizMode.COUNTDOWN]: "Countdown",
};

/**
 * Lesson type display names.
 */
export const LESSON_TYPE_NAMES: Record<QuizType, string> = {
  [QuizType.PICTOGRAPH_TO_LETTER]: "Pictograph to Letter",
  [QuizType.LETTER_TO_PICTOGRAPH]: "Letter to Pictograph",
  [QuizType.VALID_NEXT_PICTOGRAPH]: "Valid Next Pictograph",
};
