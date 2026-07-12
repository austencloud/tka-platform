/**
 * Types of lessons available in the learning module.
 */
export enum QuizType {
  PICTOGRAPH_TO_LETTER = "pictograph_to_letter",
  LETTER_TO_PICTOGRAPH = "letter_to_pictograph",
  VALID_NEXT_PICTOGRAPH = "valid_next_pictograph",
  SEQUENCE_TO_WORD = "sequence_to_word",
  // Mandala family (Play arcade): answers are whole sequences (choreo cards)
  // or mandalas, never letters — gap detection has no letter signal here and
  // deliberately returns null for these types.
  MANDALA_TO_CARD = "mandala_to_card",
  CARD_TO_MANDALA = "card_to_mandala",
  MOTION_TO_MANDALA = "motion_to_mandala",
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
  SEQUENCE_3D = "sequence_3d",
}

/**
 * Answer formats for different lesson types.
 */
export enum QuizAnswerFormat {
  BUTTON = "button",
  PICTOGRAPH = "pictograph",
  WORD_BUTTON = "word_button",
}

/**
 * Answer feedback types.
 */
export enum QuizAnswerFeedback {
  CORRECT = "correct",
  INCORRECT = "incorrect",
  NONE = "none",
}
