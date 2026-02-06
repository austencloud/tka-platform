/**
 * Types of lessons available in the learning module.
 */
export enum QuizType {
  PICTOGRAPH_TO_LETTER = "pictograph_to_letter",
  LETTER_TO_PICTOGRAPH = "letter_to_pictograph",
  VALID_NEXT_PICTOGRAPH = "valid_next_pictograph",
}

/**
 * Quiz modes for lesson execution.
 */
export enum QuizMode {
  FIXED_QUESTION = "fixed_question",
  COUNTDOWN = "countdown",
}

/**
 * Available views in the learn tab.
 */
export enum QuizView {
  LESSON_SELECTOR = "lesson_selector",
  LESSON_WORKSPACE = "lesson_workspace",
  LESSON_RESULTS = "lesson_results",
}

/**
 * Layout modes for lesson workspace.
 */
export enum QuizLayoutMode {
  VERTICAL = "vertical", // Question top, answers bottom
  HORIZONTAL = "horizontal", // Question left, answers right
}

/**
 * Question formats for different lesson types.
 */
export enum QuizQuestionFormat {
  PICTOGRAPH = "pictograph",
  LETTER = "letter",
  TEXT = "text",
}

/**
 * Answer formats for different lesson types.
 */
export enum QuizAnswerFormat {
  BUTTON = "button",
  PICTOGRAPH = "pictograph",
}

/**
 * Answer feedback types.
 */
export enum QuizAnswerFeedback {
  CORRECT = "correct",
  INCORRECT = "incorrect",
  NONE = "none",
}
