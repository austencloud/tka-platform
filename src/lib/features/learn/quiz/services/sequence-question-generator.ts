import type { Deck } from "$lib/features/choreo-card/domain/models/Deck";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import { loadDecks, loadDeckSequences } from "$lib/features/choreo-card/services/deck-loader";
import { QuizAnswerFormat, QuizQuestionFormat, QuizType } from "../domain/enums/quiz-enums";
import type { QuizAnswerOption, QuizQuestionData } from "../domain/models/quiz-models";

let sequencePool: SequenceData[] = [];
let isInitialized = false;
const recentWords: string[] = [];
const RECENT_WORD_HISTORY = 5;

export async function initialize(): Promise<void> {
  if (isInitialized) return;

  const allDecks = await loadDecks();
  const matchingDecks = allDecks.filter(
    (d: Deck) =>
      d.level === 1 &&
      d.loopType === "rotated" &&
      d.sliceType === "quartered" &&
      d.stepCount === 16
  );

  if (matchingDecks.length === 0) {
    throw new Error("No L1 rotated quartered 16-count decks found");
  }

  const allSequences: SequenceData[] = [];
  for (const deck of matchingDecks) {
    const seqs = await loadDeckSequences(deck.id);
    allSequences.push(...seqs);
  }

  sequencePool = allSequences.filter((s) => s.word && s.word.length > 0);

  if (sequencePool.length < 4) {
    throw new Error(
      `Need at least 4 sequences with distinct words, found ${sequencePool.length}`
    );
  }

  isInitialized = true;
}

export async function generateSequenceToWordQuestion(
  questionId: string
): Promise<QuizQuestionData> {
  if (!isInitialized) {
    await initialize();
  }

  const correctSequence = pickRandomSequence();
  const correctWord = correctSequence.word;

  const distractorWords = pickDistractorWords(correctWord, 3);

  const allWords = [correctWord, ...distractorWords];
  shuffleArray(allWords);

  const answerOptions: QuizAnswerOption[] = allWords.map((word) => ({
    id: generateOptionId(),
    content: word,
    isCorrect: word === correctWord,
  }));

  trackRecentWord(correctWord);

  return {
    questionId,
    questionContent: correctSequence,
    answerOptions,
    correctAnswer: correctWord,
    questionType: QuizQuestionFormat.SEQUENCE_3D,
    answerType: QuizAnswerFormat.WORD_BUTTON,
    lessonType: QuizType.SEQUENCE_TO_WORD,
    generationTimestamp: new Date().toISOString(),
  };
}

export function resetState(): void {
  recentWords.length = 0;
}

function pickRandomSequence(): SequenceData {
  let candidates = sequencePool.filter(
    (s) => !recentWords.includes(s.word)
  );

  if (candidates.length < 4) {
    candidates = sequencePool;
    recentWords.length = 0;
  }

  return candidates[Math.floor(Math.random() * candidates.length)]!;
}

function pickDistractorWords(correctWord: string, count: number): string[] {
  const uniqueWords = [
    ...new Set(sequencePool.map((s) => s.word).filter((w) => w !== correctWord)),
  ];

  shuffleArray(uniqueWords);
  return uniqueWords.slice(0, count);
}

function trackRecentWord(word: string): void {
  recentWords.push(word);
  if (recentWords.length > RECENT_WORD_HISTORY) {
    recentWords.shift();
  }
}

function shuffleArray<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j]!, array[i]!];
  }
}

function generateOptionId(): string {
  return `opt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
