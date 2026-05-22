/**
 * Question Generator - 2025 Modern Implementation
 *
 * Generates quiz questions for all three lesson types using real pictograph data.
 * Implements the logic from the legacy desktop app with modern TypeScript patterns.
 */

import * as SequenceQuestionGenerator from "./sequence-question-generator";
import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import { letterQueryHandler } from "$lib/shared/pictograph/tka-glyph/services/implementations/LetterQueryHandler";
import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  QuizAnswerFormat,
  QuizQuestionFormat,
  QuizType,
} from "../domain/enums/quiz-enums";
import {
  type QuizAnswerOption,
  type QuizQuestionData,
} from "../domain/models/quiz-models";

// ============================================================================
// Module-level state
// ============================================================================

let previousCorrectLetter: Letter | null = null;
let allPictographs: PictographData[] = [];
const pictographsByLetter: Map<Letter, PictographData[]> = new Map();
let availableLetters: Letter[] = [];
let isInitialized = false;

// ============================================================================
// Public API
// ============================================================================

/**
 * Initialize the module - must be called before generating questions.
 * Loads pictographs from static CSV files using ILetterQueryHandler.
 */
export async function initialize(): Promise<void> {
  if (isInitialized) return;

  try {
    // Load ALL pictograph variations from CSV (Diamond mode)
    allPictographs = await letterQueryHandler.getAllPictographVariations(GridMode.DIAMOND);

    // Group by letter
    pictographsByLetter.clear();
    allPictographs.forEach((picto) => {
      if (picto.letter) {
        const existing = pictographsByLetter.get(picto.letter) || [];
        existing.push(picto);
        pictographsByLetter.set(picto.letter, existing);
      }
    });

    // Get available letters
    availableLetters = Array.from(pictographsByLetter.keys());

    isInitialized = true;
  } catch (error) {
    console.error("❌ QuestionGenerator: Failed to initialize:", error);
    throw error;
  }
}

/**
 * Generate a question for a specific quiz type.
 */
export async function generateQuestion(quizType: QuizType): Promise<QuizQuestionData> {
  if (!isInitialized) {
    await initialize();
  }

  if (availableLetters.length === 0) {
    const errorMsg = `No pictographs available to generate questions. Loaded: ${allPictographs.length} total pictographs, ${pictographsByLetter.size} have letters. Initialized: ${isInitialized}`;
    console.error("❌ QuestionGenerator:", errorMsg);
    throw new Error(errorMsg);
  }

  const questionId = generateQuestionId();

  switch (quizType) {
    case QuizType.PICTOGRAPH_TO_LETTER:
      return generatePictographToLetterQuestion(questionId);
    case QuizType.LETTER_TO_PICTOGRAPH:
      return generateLetterToPictographQuestion(questionId);
    case QuizType.VALID_NEXT_PICTOGRAPH:
      return generateValidNextPictographQuestion(questionId);
    case QuizType.SEQUENCE_TO_WORD:
      return SequenceQuestionGenerator.generateSequenceToWordQuestion(questionId);
    default:
      throw new Error(`Unsupported quiz type: ${quizType}`);
  }
}

/**
 * Reset generator state.
 */
export function resetState(): void {
  previousCorrectLetter = null;
}

// ============================================================================
// Private helpers
// ============================================================================

/**
 * LESSON 1: Pictograph to Letter
 * Show a pictograph, user picks the correct letter
 */
function generatePictographToLetterQuestion(questionId: string): QuizQuestionData {
  // Pick a random letter (avoid repeating the same letter)
  const correctLetter = getRandomLetter();
  const correctPictographs = pictographsByLetter.get(correctLetter);

  if (!correctPictographs || correctPictographs.length === 0) {
    throw new Error(`No pictographs found for letter: ${correctLetter}`);
  }

  // Pick a random pictograph for this letter
  const correctPictograph = getRandomItem(correctPictographs);

  // Generate 3 wrong letters
  const wrongLetters = generateWrongLetters(correctLetter, 3);

  // Create answer options (correct + 3 wrong)
  const allLetters = [correctLetter, ...wrongLetters];
  shuffleArray(allLetters);

  const answerOptions: QuizAnswerOption[] = allLetters.map((letter) => ({
    id: generateOptionId(),
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
function generateLetterToPictographQuestion(questionId: string): QuizQuestionData {
  // Pick a random letter
  const correctLetter = getRandomLetter();
  const correctPictographs = pictographsByLetter.get(correctLetter);

  if (!correctPictographs || correctPictographs.length === 0) {
    throw new Error(`No pictographs found for letter: ${correctLetter}`);
  }

  // Pick a random pictograph for this letter
  const correctPictograph = getRandomItem(correctPictographs);

  // Generate 3 wrong pictographs (from different letters)
  const wrongPictographs = generateWrongPictographs(correctLetter, 3);

  // Create answer options
  const allPictos = [correctPictograph, ...wrongPictographs];
  shuffleArray(allPictos);

  const answerOptions: QuizAnswerOption[] = allPictos.map((pictograph) => ({
    id: generateOptionId(),
    content: pictograph,
    isCorrect: pictograph.letter === correctLetter,
  }));

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
function generateValidNextPictographQuestion(questionId: string): QuizQuestionData {
  // Generate initial pictograph (must have START_POS == END_POS)
  const initialPictograph = generateInitialPictograph();

  if (!initialPictograph.endPosition) {
    throw new Error("Initial pictograph missing endPosition");
  }

  // Find valid next pictograph (START_POS == initial's END_POS)
  const correctNextPictograph = generateCorrectNextPictograph(initialPictograph);

  // Generate 3 wrong next pictographs (START_POS != initial's END_POS)
  const wrongNextPictographs = generateWrongNextPictographs(initialPictograph, 3);

  // Create answer options
  const allOptions = [correctNextPictograph, ...wrongNextPictographs];
  shuffleArray(allOptions);

  const answerOptions: QuizAnswerOption[] = allOptions.map((pictograph) => ({
    id: generateOptionId(),
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

/**
 * Get a random letter, avoiding the previous one
 */
function getRandomLetter(): Letter {
  let candidates = [...availableLetters];

  // Avoid repeating the same letter
  if (previousCorrectLetter && candidates.length > 1) {
    candidates = candidates.filter((l) => l !== previousCorrectLetter);
  }

  const letter = getRandomItem(candidates);
  previousCorrectLetter = letter;
  return letter;
}

/**
 * Generate wrong letters (different from correct)
 */
function generateWrongLetters(correctLetter: Letter, count: number): Letter[] {
  const wrongLetters = availableLetters.filter((letter) => letter !== correctLetter);
  return getRandomItems(wrongLetters, count);
}

/**
 * Generate wrong pictographs (from different letters)
 */
function generateWrongPictographs(correctLetter: Letter, count: number): PictographData[] {
  const wrongLetters = generateWrongLetters(correctLetter, count);
  const wrongPictographs: PictographData[] = [];

  for (const letter of wrongLetters) {
    const pictographs = pictographsByLetter.get(letter);
    if (pictographs && pictographs.length > 0) {
      wrongPictographs.push(getRandomItem(pictographs));
    }
  }

  return wrongPictographs;
}

/**
 * Generate initial pictograph for Lesson 3
 * Must have startPosition === endPosition
 */
function generateInitialPictograph(): PictographData {
  const validPictographs = allPictographs.filter(
    (p) => p.startPosition && p.endPosition && p.startPosition === p.endPosition
  );

  if (validPictographs.length === 0) {
    // Fallback: just pick any pictograph
    console.warn("⚠️ No pictographs with startPos === endPos found, using fallback");
    return getRandomItem(allPictographs);
  }

  return getRandomItem(validPictographs);
}

/**
 * Generate correct next pictograph for Lesson 3
 * Must have startPosition === initialPictograph.endPosition
 */
function generateCorrectNextPictograph(initialPictograph: PictographData): PictographData {
  const endPos = initialPictograph.endPosition;

  const validNextPictographs = allPictographs.filter((p) => p.startPosition === endPos);

  if (validNextPictographs.length === 0) {
    throw new Error(`No valid next pictographs found for endPosition: ${endPos}`);
  }

  return getRandomItem(validNextPictographs);
}

/**
 * Generate wrong next pictographs for Lesson 3
 * Must have startPosition !== initialPictograph.endPosition
 */
function generateWrongNextPictographs(
  initialPictograph: PictographData,
  count: number
): PictographData[] {
  const endPos = initialPictograph.endPosition;

  const invalidNextPictographs = allPictographs.filter((p) => p.startPosition !== endPos);

  if (invalidNextPictographs.length < count) {
    console.warn(
      `⚠️ Only ${invalidNextPictographs.length} invalid next pictographs available, requested ${count}`
    );
    return getRandomItems(invalidNextPictographs, invalidNextPictographs.length);
  }

  return getRandomItems(invalidNextPictographs, count);
}

function getRandomItem<T>(array: T[]): T {
  if (array.length === 0) {
    throw new Error("Cannot get random item from empty array");
  }
  return array[Math.floor(Math.random() * array.length)]!;
}

function getRandomItems<T>(array: T[], count: number): T[] {
  const shuffled = [...array].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, array.length));
}

function shuffleArray<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j]!, array[i]!];
  }
}

function generateQuestionId(): string {
  return `q_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function generateOptionId(): string {
  return `opt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
