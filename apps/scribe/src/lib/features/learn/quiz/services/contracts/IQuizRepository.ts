/**
 * Lesson Repo Interface
 *
 * Contract for lesson configuration management and retrieval.
 * Handles lesson types, configurations, and category management.
 */

import type { QuizConfig } from "../../domain/models/quiz-models";
import type { LetterCategory } from "../../../codex/domain/types/codex-types";

export interface IQuizRepoManager {
  /**
   * Initialize the repository with lesson configurations
   */
  initialize(): Promise<void>;

  /**
   * Get lesson configuration by lesson type
   */
  getQuizConfig(quizType: string): QuizConfig | null;

  /**
   * Get all available lesson types
   */
  getAllQuizTypes(): string[];

  /**
   * Get letters associated with a specific lesson
   */
  getLettersForLesson(quizType: string): string[];

  /**
   * Get letter categories for a specific lesson
   */
  getLessonCategories(quizType: string): LetterCategory[];
}
