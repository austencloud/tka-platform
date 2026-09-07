/**
 * Curriculum media and approved teaching copy for the founding Learning
 * Letters deck. Keeping both on the word record prevents a performance video
 * from drifting away from the explanation it demonstrates.
 *
 * Empty slots are deliberate. Videos can be attached as they are produced;
 * explanatory prose stays null until it clears the Learn copy review gate.
 */

export const LEARNING_LETTERS_DECK_WORDS = [
  "AAAA",
  "BBBB",
  "CCCC",
  "GGGG",
  "HHHH",
  "IIII",
  "SSSS",
  "TTTT",
  "UUUU",
  "VVVV",
  "JDJD",
  "KEKE",
  "LFLF",
  "DJDJ",
  "EKEK",
  "FLFL",
  "MPMP",
  "NQNQ",
  "OROR",
] as const;

export type LearningLetterWord = (typeof LEARNING_LETTERS_DECK_WORDS)[number];

export interface LearningLetterVideo {
  src: string;
  poster?: string;
  captionsSrc?: string;
}

export interface LearningLetterExplanation {
  paragraphs: readonly string[];
  sourceRefs: readonly string[];
  approvalRef: string;
}

export interface LearningLetterTeachingContent {
  word: LearningLetterWord;
  video: LearningLetterVideo | null;
  explanation: LearningLetterExplanation | null;
}

export const LEARNING_LETTER_TEACHING_CONTENT = LEARNING_LETTERS_DECK_WORDS.map(
  (word): LearningLetterTeachingContent => ({
    word,
    video: null,
    explanation: null,
  })
);

const CONTENT_BY_WORD = new Map(
  LEARNING_LETTER_TEACHING_CONTENT.map((content) => [content.word, content])
);

export function getLearningLetterTeachingContent(
  word: string
): LearningLetterTeachingContent | null {
  return CONTENT_BY_WORD.get(word as LearningLetterWord) ?? null;
}
