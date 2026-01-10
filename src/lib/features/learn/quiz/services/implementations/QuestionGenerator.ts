/**
 * Question Generator Service - 2025 Modern Implementation
 *
 * Generates quiz questions for all three lesson types using real pictograph data.
 * Implements the logic from the legacy desktop app with modern TypeScript patterns.
 */

import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import { container } from "$lib/shared/di";
import type { ILetterQueryHandler } from "$lib/shared/foundation/services/contracts/data/data-contracts";
import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  QuizAnswerFormat,
  QuizQuestionFormat,
  QuizType,
} from "../../domain/enums/quiz-enums";
import {
  type QuizAnswerOption,
  type QuizQuestionData,
} from "../../domain/models/quiz-models";

export class QuestionGeneratorService {
  private static letterQueryHandler: ILetterQueryHandler | null = null;
  private static previousCorrectLetter: Letter | null = null;
  private static allPictographs: PictographData[] = [];
  private static pictographsByLetter: Map<Letter, PictographData[]> = new Map();
  private static availableLetters: Letter[] = [];
  private static isInitialized = false;

  /**
   * Initialize the service - must be called before generating questions
   * Loads pictographs from static CSV files using ILetterQueryHandler
   */
  static async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.letterQueryHandler = container.items.letterQueryHandler;

      // Load ALL pictograph variations from CSV (Diamond mode)
      this.allPictographs =
        await this.letterQueryHandler.getAllPictographVariations(
          GridMode.DIAMOND
        );

      // Group by letter
      this.pictographsByLetter.clear();
      this.allPictographs.forEach((picto) => {
        if (picto.letter) {
          const existing = this.pictographsByLetter.get(picto.letter) || [];
          existing.push(picto);
          this.pictographsByLetter.set(picto.letter, existing);
        }
      });

      // Get available letters
      this.availableLetters = Array.from(this.pictographsByLetter.keys());

      this.isInitialized = true;
    } catch (error) {
      console.error("❌ QuestionGenerator: Failed to initialize:", error);
      throw error;
    }
  }

  /**
   * Generate a question for a specific quiz type
   */
  static async generateQuestion(quizType: QuizType): Promise<QuizQuestionData> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (this.availableLetters.length === 0) {
      const errorMsg = `No pictographs available to generate questions. Loaded: ${this.allPictographs.length} total pictographs, ${this.pictographsByLetter.size} have letters. Initialized: ${this.isInitialized}`;
      console.error("❌ QuestionGenerator:", errorMsg);
      throw new Error(errorMsg);
    }

    const questionId = this.generateQuestionId();

    switch (quizType) {
      case QuizType.PICTOGRAPH_TO_LETTER:
        return this.generatePictographToLetterQuestion(questionId);
      case QuizType.LETTER_TO_PICTOGRAPH:
        return this.generateLetterToPictographQuestion(questionId);
      case QuizType.VALID_NEXT_PICTOGRAPH:
        return this.generateValidNextPictographQuestion(questionId);
      default:
        throw new Error(`Unsupported quiz type: ${quizType}`);
    }
  }

  /**
   * LESSON 1: Pictograph to Letter
   * Show a pictograph, user picks the correct letter
   */
  private static generatePictographToLetterQuestion(
    questionId: string
  ): QuizQuestionData {
    // Pick a random letter (avoid repeating the same letter)
    const correctLetter = this.getRandomLetter();
    const correctPictographs = this.pictographsByLetter.get(correctLetter);

    if (!correctPictographs || correctPictographs.length === 0) {
      throw new Error(`No pictographs found for letter: ${correctLetter}`);
    }

    // Pick a random pictograph for this letter
    const correctPictograph = this.getRandomItem(correctPictographs);

    // Generate 3 wrong letters
    const wrongLetters = this.generateWrongLetters(correctLetter, 3);

    // Create answer options (correct + 3 wrong)
    const allLetters = [correctLetter, ...wrongLetters];
    this.shuffleArray(allLetters);

    const answerOptions: QuizAnswerOption[] = allLetters.map((letter) => ({
      id: this.generateOptionId(),
      content: letter,
      isCorrect: letter === correctLetter,
    }));

    return {
      questionId,
      questionContent: correctPictograph,
      answerOptions,
      correctAnswer: correctLetter,
      questionType: QuizQuestionFormat.PICTOGRAPH,
      answerType: QuizAnswerFormat.BUTTON,
      lessonType: QuizType.PICTOGRAPH_TO_LETTER,
      generationTimestamp: new Date().toISOString(),
    };
  }

  /**
   * LESSON 2: Letter to Pictograph
   * Show a letter, user picks the correct pictograph
   */
  private static generateLetterToPictographQuestion(
    questionId: string
  ): QuizQuestionData {
    // Pick a random letter
    const correctLetter = this.getRandomLetter();
    const correctPictographs = this.pictographsByLetter.get(correctLetter);

    if (!correctPictographs || correctPictographs.length === 0) {
      throw new Error(`No pictographs found for letter: ${correctLetter}`);
    }

    // Pick a random pictograph for this letter
    const correctPictograph = this.getRandomItem(correctPictographs);

    // Generate 3 wrong pictographs (from different letters)
    const wrongPictographs = this.generateWrongPictographs(correctLetter, 3);

    // Create answer options
    const allPictographs = [correctPictograph, ...wrongPictographs];
    this.shuffleArray(allPictographs);

    const answerOptions: QuizAnswerOption[] = allPictographs.map(
      (pictograph) => ({
        id: this.generateOptionId(),
        content: pictograph,
        isCorrect: pictograph.letter === correctLetter,
      })
    );

    return {
      questionId,
      questionContent: correctLetter,
      answerOptions,
      correctAnswer: correctPictograph,
      questionType: QuizQuestionFormat.LETTER,
      answerType: QuizAnswerFormat.PICTOGRAPH,
      lessonType: QuizType.LETTER_TO_PICTOGRAPH,
      generationTimestamp: new Date().toISOString(),
    };
  }

  /**
   * LESSON 3: Valid Next Pictograph
   * Show a pictograph, user picks which pictograph can follow it
   * Rule: Next pictograph's START_POS must equal initial pictograph's END_POS
   */
  private static generateValidNextPictographQuestion(
    questionId: string
  ): QuizQuestionData {
    // Generate initial pictograph (must have START_POS == END_POS)
    const initialPictograph = this.generateInitialPictograph();

    if (!initialPictograph.endPosition) {
      throw new Error("Initial pictograph missing endPosition");
    }

    // Find valid next pictograph (START_POS == initial's END_POS)
    const correctNextPictograph =
      this.generateCorrectNextPictograph(initialPictograph);

    // Generate 3 wrong next pictographs (START_POS != initial's END_POS)
    const wrongNextPictographs = this.generateWrongNextPictographs(
      initialPictograph,
      3
    );

    // Create answer options
    const allOptions = [correctNextPictograph, ...wrongNextPictographs];
    this.shuffleArray(allOptions);

    const answerOptions: QuizAnswerOption[] = allOptions.map((pictograph) => ({
      id: this.generateOptionId(),
      content: pictograph,
      isCorrect: pictograph.startPosition === initialPictograph.endPosition,
    }));

    return {
      questionId,
      questionContent: initialPictograph,
      answerOptions,
      correctAnswer: correctNextPictograph,
      questionType: QuizQuestionFormat.PICTOGRAPH,
      answerType: QuizAnswerFormat.PICTOGRAPH,
      lessonType: QuizType.VALID_NEXT_PICTOGRAPH,
      generationTimestamp: new Date().toISOString(),
    };
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Get a random letter, avoiding the previous one
   */
  private static getRandomLetter(): Letter {
    let candidates = [...this.availableLetters];

    // Avoid repeating the same letter
    if (this.previousCorrectLetter && candidates.length > 1) {
      candidates = candidates.filter((l) => l !== this.previousCorrectLetter);
    }

    const letter = this.getRandomItem(candidates);
    this.previousCorrectLetter = letter;
    return letter;
  }

  /**
   * Generate wrong letters (different from correct)
   */
  private static generateWrongLetters(
    correctLetter: Letter,
    count: number
  ): Letter[] {
    const wrongLetters = this.availableLetters.filter(
      (letter) => letter !== correctLetter
    );
    return this.getRandomItems(wrongLetters, count);
  }

  /**
   * Generate wrong pictographs (from different letters)
   */
  private static generateWrongPictographs(
    correctLetter: Letter,
    count: number
  ): PictographData[] {
    const wrongLetters = this.generateWrongLetters(correctLetter, count);
    const wrongPictographs: PictographData[] = [];

    for (const letter of wrongLetters) {
      const pictographs = this.pictographsByLetter.get(letter);
      if (pictographs && pictographs.length > 0) {
        wrongPictographs.push(this.getRandomItem(pictographs));
      }
    }

    return wrongPictographs;
  }

  /**
   * Generate initial pictograph for Lesson 3
   * Must have startPosition === endPosition
   */
  private static generateInitialPictograph(): PictographData {
    const validPictographs = this.allPictographs.filter(
      (p) =>
        p.startPosition && p.endPosition && p.startPosition === p.endPosition
    );

    if (validPictographs.length === 0) {
      // Fallback: just pick any pictograph
      console.warn(
        "⚠️ No pictographs with startPos === endPos found, using fallback"
      );
      return this.getRandomItem(this.allPictographs);
    }

    return this.getRandomItem(validPictographs);
  }

  /**
   * Generate correct next pictograph for Lesson 3
   * Must have startPosition === initialPictograph.endPosition
   */
  private static generateCorrectNextPictograph(
    initialPictograph: PictographData
  ): PictographData {
    const endPos = initialPictograph.endPosition;

    const validNextPictographs = this.allPictographs.filter(
      (p) => p.startPosition === endPos
    );

    if (validNextPictographs.length === 0) {
      throw new Error(
        `No valid next pictographs found for endPosition: ${endPos}`
      );
    }

    return this.getRandomItem(validNextPictographs);
  }

  /**
   * Generate wrong next pictographs for Lesson 3
   * Must have startPosition !== initialPictograph.endPosition
   */
  private static generateWrongNextPictographs(
    initialPictograph: PictographData,
    count: number
  ): PictographData[] {
    const endPos = initialPictograph.endPosition;

    const invalidNextPictographs = this.allPictographs.filter(
      (p) => p.startPosition !== endPos
    );

    if (invalidNextPictographs.length < count) {
      console.warn(
        `⚠️ Only ${invalidNextPictographs.length} invalid next pictographs available, requested ${count}`
      );
      return this.getRandomItems(
        invalidNextPictographs,
        invalidNextPictographs.length
      );
    }

    return this.getRandomItems(invalidNextPictographs, count);
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private static getRandomItem<T>(array: T[]): T {
    if (array.length === 0) {
      throw new Error("Cannot get random item from empty array");
    }
    return array[Math.floor(Math.random() * array.length)]!;
  }

  private static getRandomItems<T>(array: T[], count: number): T[] {
    const shuffled = [...array].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, array.length));
  }

  private static shuffleArray<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j]!, array[i]!];
    }
  }

  private static generateQuestionId(): string {
    return `q_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private static generateOptionId(): string {
    return `opt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Reset generator state
   */
  static resetState(): void {
    this.previousCorrectLetter = null;
  }
}
