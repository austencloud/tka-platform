/**
 * ITikaQuizGenerator - Contract for TKA Quiz Generation
 *
 * Generates interactive quizzes for testing TKA knowledge.
 * Supports multiple quiz types with visual pictograph options.
 */

export type QuizDisplayMode = "text" | "pictograph-grid" | "motion-chips";
export type QuizType =
  | "pick-letter"
  | "pick-type"
  | "odd-one-out"
  | "match-motion"
  | "true-false";
export type QuizDifficulty = "easy" | "medium" | "hard";

export interface TextOption {
  id: string;
  type: "text";
  text: string;
  correct: boolean;
}

export interface PictographOption {
  id: string;
  type: "pictograph";
  letter: string;
  variation?: number;
  correct: boolean;
}

export interface MotionPatternOption {
  id: string;
  type: "motion-pattern";
  blueMotion: string;
  redMotion: string;
  correct: boolean;
}

export type QuizOption = TextOption | PictographOption | MotionPatternOption;

export interface InlineQuiz {
  type: "inline-quiz";
  id: string;
  quizType: QuizType;
  displayMode: QuizDisplayMode;
  question: string;
  options: QuizOption[];
  pictograph?: { letter: string; variation?: number; propType?: string };
  correctFeedback: string;
  incorrectFeedback: string;
  explanation?: string;
  difficulty: QuizDifficulty;
  topic: string;
  followUpQuizzes?: InlineQuiz[];
}

export interface QuizResult {
  explanation: string;
  inlineQuiz: InlineQuiz;
}

export interface ITikaQuizGenerator {
  /**
   * Generate a quiz based on topic and type.
   *
   * @param topic - Topic to quiz on (e.g., "type1", "A", "alpha", "shift")
   * @param quizType - Type of quiz question
   * @param difficulty - Difficulty level
   * @returns Quiz result with inline quiz component
   */
  generateQuiz(
    topic: string,
    quizType?: QuizType,
    difficulty?: QuizDifficulty
  ): QuizResult;

  /**
   * Generate a quiz about a letter type.
   */
  generateTypeQuiz(
    typeNum: number,
    quizType: string,
    difficulty: QuizDifficulty
  ): QuizResult;

  /**
   * Generate a quiz about a specific letter.
   */
  generateLetterQuiz(
    letter: string,
    quizType: string,
    difficulty: QuizDifficulty
  ): QuizResult;

  /**
   * Generate a general TKA quiz.
   */
  generateGeneralQuiz(quizType: string, difficulty: QuizDifficulty): QuizResult;
}
