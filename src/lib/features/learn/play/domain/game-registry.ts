/**
 * The Play arcade game roster. Adding a game = adding an entry here plus a
 * game component route in GameShell. Level pools use @tka/domain groupings —
 * no hand-rolled letter lists.
 */
import { getLettersByType, ALL_LETTERS } from "@tka/domain";
import { QuizType } from "../../quiz/domain/enums/quiz-enums";
import type { GameDefinition } from "./arcade-types";

const TYPE1 = getLettersByType(1).map(String);
const SHIFT_LETTERS = [1, 2, 3].flatMap((t) => getLettersByType(t as 1 | 2 | 3)).map(String);
const ALL = ALL_LETTERS.map(String);

export const GAME_REGISTRY: GameDefinition[] = [
  {
    id: "pictograph-to-letter",
    title: "Name That Pictograph",
    tagline: "See the pictograph. Call the letter.",
    accentColor: "#38bdf8",
    quizType: QuizType.PICTOGRAPH_TO_LETTER,
    levels: [
      { levelNumber: 1, title: "Type 1", mode: { kind: "fixed", questionCount: 10 }, constraints: { letters: TYPE1 }, stars: { one: 600, two: 1000, three: 1400 } },
      { levelNumber: 2, title: "All Shifts", mode: { kind: "fixed", questionCount: 15 }, constraints: { letters: SHIFT_LETTERS }, stars: { one: 900, two: 1500, three: 2100 } },
      { levelNumber: 3, title: "Full Alphabet", mode: { kind: "fixed", questionCount: 20 }, constraints: { letters: ALL }, stars: { one: 1200, two: 2000, three: 2800 } },
      { levelNumber: 4, title: "Countdown", mode: { kind: "countdown", seconds: 90 }, constraints: { letters: ALL }, stars: { one: 1500, two: 2500, three: 3500 } },
    ],
  },
  {
    id: "letter-to-pictograph",
    title: "Picture This",
    tagline: "See the letter. Pick its pictograph.",
    accentColor: "#a78bfa",
    quizType: QuizType.LETTER_TO_PICTOGRAPH,
    levels: [
      { levelNumber: 1, title: "Type 1", mode: { kind: "fixed", questionCount: 10 }, constraints: { letters: TYPE1 }, stars: { one: 600, two: 1000, three: 1400 } },
      { levelNumber: 2, title: "All Shifts", mode: { kind: "fixed", questionCount: 15 }, constraints: { letters: SHIFT_LETTERS }, stars: { one: 900, two: 1500, three: 2100 } },
      { levelNumber: 3, title: "Full Alphabet", mode: { kind: "fixed", questionCount: 20 }, constraints: { letters: ALL }, stars: { one: 1200, two: 2000, three: 2800 } },
      { levelNumber: 4, title: "Countdown", mode: { kind: "countdown", seconds: 90 }, constraints: { letters: ALL }, stars: { one: 1500, two: 2500, three: 3500 } },
    ],
  },
  {
    id: "valid-next",
    title: "What Comes Next",
    tagline: "Which pictograph can legally follow?",
    accentColor: "#34d399",
    quizType: QuizType.VALID_NEXT_PICTOGRAPH,
    levels: [
      { levelNumber: 1, title: "Four Options", mode: { kind: "fixed", questionCount: 10 }, constraints: { optionCount: 4 }, stars: { one: 600, two: 1000, three: 1400 } },
      { levelNumber: 2, title: "Six Options", mode: { kind: "fixed", questionCount: 12 }, constraints: { optionCount: 6 }, stars: { one: 750, two: 1250, three: 1750 } },
      { levelNumber: 3, title: "Countdown", mode: { kind: "countdown", seconds: 90 }, constraints: { optionCount: 6 }, stars: { one: 1200, two: 2000, three: 3000 } },
    ],
  },
  {
    id: "performer-word",
    title: "Read the Performer",
    tagline: "Watch the flow. Name the word.",
    accentColor: "#fb923c",
    quizType: QuizType.SEQUENCE_TO_WORD,
    levels: [
      { levelNumber: 1, title: "Short Words", mode: { kind: "fixed", questionCount: 6 }, constraints: { wordLength: 2 }, stars: { one: 350, two: 600, three: 850 } },
      { levelNumber: 2, title: "Longer Words", mode: { kind: "fixed", questionCount: 8 }, constraints: { wordLength: 3 }, stars: { one: 500, two: 800, three: 1100 } },
      { levelNumber: 3, title: "Full Phrases", mode: { kind: "fixed", questionCount: 10 }, constraints: { wordLength: 4 }, stars: { one: 600, two: 1000, three: 1400 } },
    ],
  },
  {
    id: "speed-blitz",
    title: "Speed Blitz",
    tagline: "The letters come faster. Keep up.",
    accentColor: "#f472b6",
    quizType: QuizType.PICTOGRAPH_TO_LETTER,
    levels: [
      { levelNumber: 1, title: "Warm Up", mode: { kind: "fixed", questionCount: 15 }, constraints: { letters: TYPE1, paceStartSeconds: 6, paceEndSeconds: 3 }, stars: { one: 900, two: 1500, three: 2200 } },
      { levelNumber: 2, title: "Fast Ramp", mode: { kind: "fixed", questionCount: 20 }, constraints: { letters: ALL, paceStartSeconds: 5, paceEndSeconds: 2 }, stars: { one: 1300, two: 2200, three: 3200 } },
      { levelNumber: 3, title: "Survival", mode: { kind: "survival", maxMisses: 3 }, constraints: { letters: ALL, paceStartSeconds: 5, paceEndSeconds: 1.5 }, stars: { one: 1500, two: 3000, three: 5000 } },
    ],
  },
  {
    id: "mandala-match",
    title: "Mandala Match",
    tagline: "One mandala. Pick the card that made it.",
    accentColor: "#fbbf24",
    quizType: QuizType.MANDALA_TO_CARD,
    levels: [
      { levelNumber: 1, title: "Four Cards", mode: { kind: "fixed", questionCount: 8 }, constraints: { optionCount: 4, stepCount: 8 }, stars: { one: 500, two: 800, three: 1100 } },
      { levelNumber: 2, title: "Six Cards", mode: { kind: "fixed", questionCount: 10 }, constraints: { optionCount: 6, stepCount: 8 }, stars: { one: 650, two: 1050, three: 1450 } },
      { levelNumber: 3, title: "Lookalikes", mode: { kind: "fixed", questionCount: 10 }, constraints: { optionCount: 6, stepCount: 8 }, stars: { one: 700, two: 1150, three: 1600 } },
    ],
  },
  {
    id: "card-to-mandala",
    title: "Trace the Card",
    tagline: "Read the card. Pick the mandala it traces.",
    accentColor: "#2dd4bf",
    quizType: QuizType.CARD_TO_MANDALA,
    levels: [
      { levelNumber: 1, title: "Four Blooms", mode: { kind: "fixed", questionCount: 8 }, constraints: { optionCount: 4, stepCount: 8 }, stars: { one: 500, two: 800, three: 1100 } },
      { levelNumber: 2, title: "Six Blooms", mode: { kind: "fixed", questionCount: 10 }, constraints: { optionCount: 6, stepCount: 8 }, stars: { one: 650, two: 1050, three: 1450 } },
      { levelNumber: 3, title: "Lookalikes", mode: { kind: "fixed", questionCount: 10 }, constraints: { optionCount: 6, stepCount: 8 }, stars: { one: 700, two: 1150, three: 1600 } },
    ],
  },
  {
    id: "motion-to-mandala",
    title: "Watch It Bloom",
    tagline: "Watch the flow. Pick the mandala it leaves.",
    accentColor: "#c084fc",
    quizType: QuizType.MOTION_TO_MANDALA,
    levels: [
      { levelNumber: 1, title: "Four Blooms", mode: { kind: "fixed", questionCount: 6 }, constraints: { optionCount: 4, stepCount: 8 }, stars: { one: 350, two: 600, three: 850 } },
      { levelNumber: 2, title: "Six Blooms", mode: { kind: "fixed", questionCount: 8 }, constraints: { optionCount: 6, stepCount: 8 }, stars: { one: 500, two: 800, three: 1100 } },
      { levelNumber: 3, title: "Lookalikes", mode: { kind: "fixed", questionCount: 8 }, constraints: { optionCount: 6, stepCount: 8 }, stars: { one: 550, two: 900, three: 1250 } },
    ],
  },
];

export function getGame(id: string): GameDefinition | undefined {
  return GAME_REGISTRY.find((g) => g.id === id);
}
