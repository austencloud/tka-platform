import type { Catalog } from "$lib/features/choreo-card/domain/models/Catalog";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { getCachedCatalogs, loadCatalogs, loadCatalogSequencesPage } from "$lib/features/choreo-card/services/catalog-loader";
import { QuizAnswerFormat, QuizQuestionFormat, QuizType } from "../domain/enums/quiz-enums";
import type { QuizAnswerOption, QuizQuestionData } from "../domain/models/quiz-models";
import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";

let sequencePool: SequenceData[] = [];
let isInitialized = false;
const recentWords: string[] = [];
const RECENT_WORD_HISTORY = 5;
const LOAD_TIMEOUT_MS = 15_000;
const SEQS_PER_CATALOG = 8;

const sequenceCatalogMap = new Map<string, string>();

export function getCatalogIdForSequence(sequenceId: string): string | undefined {
  return sequenceCatalogMap.get(sequenceId);
}

function isMatchingCatalog(d: Catalog): boolean {
  return d.level === 1;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

export async function initialize(): Promise<void> {
  if (isInitialized) return;

  const cached = getCachedCatalogs();
  let allCatalogs: Catalog[];

  if (cached && cached.length > 0) {
    allCatalogs = cached;
  } else {
    allCatalogs = await withTimeout(loadCatalogs(), LOAD_TIMEOUT_MS, "loadCatalogs");
  }

  const matchingCatalogs = allCatalogs.filter(isMatchingCatalog);

  if (matchingCatalogs.length === 0) {
    throw new Error("No L1 rotated quartered 16-count catalogs found");
  }

  shuffleArray(matchingCatalogs);
  const catalogsToLoad = matchingCatalogs.slice(0, 20);

  const loads = catalogsToLoad.map((catalog) =>
    withTimeout(
      loadCatalogSequencesPage(catalog.id, SEQS_PER_CATALOG),
      LOAD_TIMEOUT_MS,
      `loadCatalogSequencesPage(${catalog.id})`
    )
      .then((r) => ({ catalogId: catalog.id, sequences: r.sequences }))
      .catch(() => ({ catalogId: catalog.id, sequences: [] as SequenceData[] }))
  );

  const results = await Promise.all(loads);

  sequenceCatalogMap.clear();
  sequencePool = [];
  for (const { catalogId, sequences } of results) {
    for (const seq of sequences) {
      if (seq.word && seq.word.length > 0) {
        sequencePool.push(seq);
        sequenceCatalogMap.set(seq.id, catalogId);
      }
    }
  }

  if (sequencePool.length < 4) {
    throw new Error(
      `Need at least 4 sequences with distinct words across ${matchingCatalogs.length} catalogs, found ${sequencePool.length}`
    );
  }

  isInitialized = true;
}

/**
 * Optional constraints for sequence-based questions, used by the Play arcade
 * (Read the Performer, Mandala Match).
 */
export interface SequenceQuestionOptions {
  /** Soft filter: prefer sequences whose simplified word is this length;
   *  falls back to the unfiltered pool if fewer than 4 candidates match. */
  wordLength?: number;
  /** Total answer options including the correct one (default 4). */
  optionCount?: number;
  /** Prefer distractor words that share more letters with the target word
   *  (lookalikes), ranked by shared-letter count descending. Mandala Match's
   *  "Lookalikes" level (3) is the only caller that sets this. */
  similarDistractors?: boolean;
}

export async function generateSequenceToWordQuestion(
  questionId: string,
  options: SequenceQuestionOptions = {}
): Promise<QuizQuestionData> {
  if (!isInitialized) {
    await initialize();
  }

  const correctSequence = pickRandomSequence(options.wordLength);
  const correctWord = simplifyRepeatedWord(correctSequence.word);

  const distractorWords = pickDistractorWords(
    correctSequence.word,
    (options.optionCount ?? 4) - 1,
    options.similarDistractors ?? false
  );

  const allWords = [correctWord, ...distractorWords];
  shuffleArray(allWords);

  const answerOptions: QuizAnswerOption[] = allWords.map((word) => ({
    id: generateOptionId(),
    content: word,
    isCorrect: word === correctWord,
  }));

  trackRecentWord(correctSequence.word);

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
  sequencePool = [];
  sequenceCatalogMap.clear();
  isInitialized = false;
}

function pickRandomSequence(wordLength?: number): SequenceData {
  let candidates = sequencePool.filter(
    (s) => !recentWords.includes(s.word)
  );

  if (candidates.length < 4) {
    candidates = sequencePool;
    recentWords.length = 0;
  }

  // Soft length filter: prefer sequences whose simplified word matches the
  // requested length, but never starve the question generator over it — fall
  // back to the unfiltered candidate pool when too few match.
  if (wordLength !== undefined) {
    const lengthMatches = candidates.filter(
      (s) => simplifyRepeatedWord(s.word).length === wordLength
    );
    if (lengthMatches.length >= 4) {
      candidates = lengthMatches;
    }
  }

  return candidates[Math.floor(Math.random() * candidates.length)]!;
}

function pickDistractorWords(
  correctRawWord: string,
  count: number,
  preferSimilar = false
): string[] {
  const correctSimplified = simplifyRepeatedWord(correctRawWord);
  const uniqueWords = [
    ...new Set(
      sequencePool
        .map((s) => simplifyRepeatedWord(s.word))
        .filter((w) => w !== correctSimplified)
    ),
  ];

  // Distinct-word guarantee preserved either way — uniqueWords is already
  // deduped above. Shuffle first so a shared-letter-count tie doesn't always
  // resolve to the same catalog order.
  shuffleArray(uniqueWords);

  if (preferSimilar) {
    uniqueWords.sort(
      (a, b) => sharedLetterCount(b, correctSimplified) - sharedLetterCount(a, correctSimplified)
    );
  }

  return uniqueWords.slice(0, count);
}

/**
 * Rough "how similar do these look" signal for the lookalike-distractor mode:
 * count of distinct letters `a` shares with `b` (order-insensitive, each
 * letter counted once). Not a TKA-domain claim — just a difficulty knob for
 * ranking candidate distractor words.
 */
function sharedLetterCount(a: string, b: string): number {
  const bLetters = new Set(b);
  let count = 0;
  for (const letter of new Set(a)) {
    if (bLetters.has(letter)) count++;
  }
  return count;
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
