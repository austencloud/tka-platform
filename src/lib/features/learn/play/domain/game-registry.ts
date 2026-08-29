/**
 * The Play arcade game roster. Adding a game = adding an entry here plus a
 * game component route in GameShell. Challenge pools use @tka/domain groupings —
 * no hand-rolled letter lists.
 */
import { getLettersByType, ALL_LETTERS } from "@tka/domain";
import { QuizType } from "../../quiz/domain/enums/quiz-enums";
import type { GameCapabilities, GameDefinition } from "./arcade-types";

/**
 * The original quiz games are all the same shape: pick an option, the engine
 * prices it. Spelled out on every entry rather than defaulted, so the shell
 * reads a game's hosting requirements off the entry instead of assuming.
 */
const QUIZ_ONLY: GameCapabilities = { scoring: "quiz" };
const UNCLASSIFIED_CURRICULUM = { status: "unclassified" } as const;

const TYPE1 = getLettersByType(1).map(String);
const SHIFT_LETTERS = [1, 2, 3]
  .flatMap((t) => getLettersByType(t as 1 | 2 | 3))
  .map(String);
const ALL = ALL_LETTERS.map(String);

export const GAME_REGISTRY: GameDefinition[] = [
  {
    id: "pictograph-to-letter",
    title: "Name That Pictograph",
    tagline: "See the pictograph. Call the letter.",
    accentColor: "#38bdf8",
    capabilities: QUIZ_ONLY,
    curriculum: UNCLASSIFIED_CURRICULUM,
    quizType: QuizType.PICTOGRAPH_TO_LETTER,
    challenges: [
      {
        challengeNumber: 1,
        title: "Type 1",
        mode: { kind: "fixed", questionCount: 10 },
        constraints: { letters: TYPE1 },
        stars: { one: 600, two: 1000, three: 1400 },
      },
      {
        challengeNumber: 2,
        title: "All Shifts",
        mode: { kind: "fixed", questionCount: 15 },
        constraints: { letters: SHIFT_LETTERS },
        stars: { one: 900, two: 1500, three: 2100 },
      },
      {
        challengeNumber: 3,
        title: "Full Alphabet",
        mode: { kind: "fixed", questionCount: 20 },
        constraints: { letters: ALL },
        stars: { one: 1200, two: 2000, three: 2800 },
      },
      {
        challengeNumber: 4,
        title: "Countdown",
        mode: { kind: "countdown", seconds: 90 },
        constraints: { letters: ALL },
        stars: { one: 1500, two: 2500, three: 3500 },
      },
    ],
  },
  {
    id: "letter-to-pictograph",
    title: "Picture This",
    tagline: "See the letter. Pick its pictograph.",
    accentColor: "#a78bfa",
    capabilities: QUIZ_ONLY,
    curriculum: UNCLASSIFIED_CURRICULUM,
    quizType: QuizType.LETTER_TO_PICTOGRAPH,
    challenges: [
      {
        challengeNumber: 1,
        title: "Type 1",
        mode: { kind: "fixed", questionCount: 10 },
        constraints: { letters: TYPE1 },
        stars: { one: 600, two: 1000, three: 1400 },
      },
      {
        challengeNumber: 2,
        title: "All Shifts",
        mode: { kind: "fixed", questionCount: 15 },
        constraints: { letters: SHIFT_LETTERS },
        stars: { one: 900, two: 1500, three: 2100 },
      },
      {
        challengeNumber: 3,
        title: "Full Alphabet",
        mode: { kind: "fixed", questionCount: 20 },
        constraints: { letters: ALL },
        stars: { one: 1200, two: 2000, three: 2800 },
      },
      {
        challengeNumber: 4,
        title: "Countdown",
        mode: { kind: "countdown", seconds: 90 },
        constraints: { letters: ALL },
        stars: { one: 1500, two: 2500, three: 3500 },
      },
    ],
  },
  {
    id: "valid-next",
    title: "What Comes Next",
    tagline: "Which pictograph can legally follow?",
    accentColor: "#34d399",
    capabilities: QUIZ_ONLY,
    curriculum: UNCLASSIFIED_CURRICULUM,
    quizType: QuizType.VALID_NEXT_PICTOGRAPH,
    challenges: [
      {
        challengeNumber: 1,
        title: "Four Options",
        mode: { kind: "fixed", questionCount: 10 },
        constraints: { optionCount: 4 },
        stars: { one: 600, two: 1000, three: 1400 },
      },
      {
        challengeNumber: 2,
        title: "Six Options",
        mode: { kind: "fixed", questionCount: 12 },
        constraints: { optionCount: 6 },
        stars: { one: 750, two: 1250, three: 1750 },
      },
      {
        challengeNumber: 3,
        title: "Countdown",
        mode: { kind: "countdown", seconds: 90 },
        constraints: { optionCount: 6 },
        stars: { one: 1200, two: 2000, three: 3000 },
      },
    ],
  },
  {
    id: "performer-word",
    title: "Read the Performer",
    tagline: "Watch the flow. Name the word.",
    accentColor: "#fb923c",
    capabilities: QUIZ_ONLY,
    curriculum: UNCLASSIFIED_CURRICULUM,
    quizType: QuizType.SEQUENCE_TO_WORD,
    challenges: [
      {
        challengeNumber: 1,
        title: "Short Words",
        mode: { kind: "fixed", questionCount: 6 },
        constraints: { wordLength: 2 },
        stars: { one: 350, two: 600, three: 850 },
      },
      {
        challengeNumber: 2,
        title: "Longer Words",
        mode: { kind: "fixed", questionCount: 8 },
        constraints: { wordLength: 3 },
        stars: { one: 500, two: 800, three: 1100 },
      },
      {
        challengeNumber: 3,
        title: "Full Phrases",
        mode: { kind: "fixed", questionCount: 10 },
        constraints: { wordLength: 4 },
        stars: { one: 600, two: 1000, three: 1400 },
      },
    ],
  },
  {
    id: "speed-blitz",
    title: "Speed Blitz",
    tagline: "The letters come faster. Keep up.",
    accentColor: "#f472b6",
    capabilities: QUIZ_ONLY,
    curriculum: UNCLASSIFIED_CURRICULUM,
    quizType: QuizType.PICTOGRAPH_TO_LETTER,
    challenges: [
      {
        challengeNumber: 1,
        title: "Warm Up",
        mode: { kind: "fixed", questionCount: 15 },
        constraints: { letters: TYPE1, paceStartSeconds: 6, paceEndSeconds: 3 },
        stars: { one: 900, two: 1500, three: 2200 },
      },
      {
        challengeNumber: 2,
        title: "Fast Ramp",
        mode: { kind: "fixed", questionCount: 20 },
        constraints: { letters: ALL, paceStartSeconds: 5, paceEndSeconds: 2 },
        stars: { one: 1300, two: 2200, three: 3200 },
      },
      {
        challengeNumber: 3,
        title: "Survival",
        mode: { kind: "survival", maxMisses: 3 },
        constraints: { letters: ALL, paceStartSeconds: 5, paceEndSeconds: 1.5 },
        stars: { one: 1500, two: 3000, three: 5000 },
      },
    ],
  },
  {
    id: "mandala-match",
    title: "Mandala Match",
    tagline: "One mandala. Pick the card that made it.",
    accentColor: "#fbbf24",
    capabilities: QUIZ_ONLY,
    curriculum: UNCLASSIFIED_CURRICULUM,
    quizType: QuizType.MANDALA_TO_CARD,
    challenges: [
      {
        challengeNumber: 1,
        title: "Four Cards",
        mode: { kind: "fixed", questionCount: 8 },
        constraints: { optionCount: 4, stepCount: 8 },
        stars: { one: 500, two: 800, three: 1100 },
      },
      {
        challengeNumber: 2,
        title: "Six Cards",
        mode: { kind: "fixed", questionCount: 10 },
        constraints: { optionCount: 6, stepCount: 8 },
        stars: { one: 650, two: 1050, three: 1450 },
      },
      {
        challengeNumber: 3,
        title: "Lookalikes",
        mode: { kind: "fixed", questionCount: 10 },
        constraints: { optionCount: 6, stepCount: 8 },
        stars: { one: 700, two: 1150, three: 1600 },
      },
    ],
  },
  {
    id: "card-to-mandala",
    title: "Trace the Card",
    tagline: "Read the card. Pick the mandala it traces.",
    accentColor: "#2dd4bf",
    capabilities: QUIZ_ONLY,
    curriculum: UNCLASSIFIED_CURRICULUM,
    quizType: QuizType.CARD_TO_MANDALA,
    challenges: [
      {
        challengeNumber: 1,
        title: "Four Blooms",
        mode: { kind: "fixed", questionCount: 8 },
        constraints: { optionCount: 4, stepCount: 8 },
        stars: { one: 500, two: 800, three: 1100 },
      },
      {
        challengeNumber: 2,
        title: "Six Blooms",
        mode: { kind: "fixed", questionCount: 10 },
        constraints: { optionCount: 6, stepCount: 8 },
        stars: { one: 650, two: 1050, three: 1450 },
      },
      {
        challengeNumber: 3,
        title: "Lookalikes",
        mode: { kind: "fixed", questionCount: 10 },
        constraints: { optionCount: 6, stepCount: 8 },
        stars: { one: 700, two: 1150, three: 1600 },
      },
    ],
  },
  {
    id: "motion-to-mandala",
    title: "Watch It Bloom",
    tagline: "Watch the flow. Pick the mandala it leaves.",
    accentColor: "#c084fc",
    capabilities: QUIZ_ONLY,
    curriculum: UNCLASSIFIED_CURRICULUM,
    quizType: QuizType.MOTION_TO_MANDALA,
    challenges: [
      {
        challengeNumber: 1,
        title: "Four Blooms",
        mode: { kind: "fixed", questionCount: 6 },
        constraints: { optionCount: 4, stepCount: 8 },
        stars: { one: 350, two: 600, three: 850 },
      },
      {
        challengeNumber: 2,
        title: "Six Blooms",
        mode: { kind: "fixed", questionCount: 8 },
        constraints: { optionCount: 6, stepCount: 8 },
        stars: { one: 500, two: 800, three: 1100 },
      },
      {
        challengeNumber: 3,
        title: "Lookalikes",
        mode: { kind: "fixed", questionCount: 8 },
        constraints: { optionCount: 6, stepCount: 8 },
        stars: { one: 550, two: 900, three: 1250 },
      },
    ],
  },
  {
    id: "word-bridges",
    title: "Mind the Gap",
    tagline: "Find the breaks. Build the missing links.",
    accentColor: "#06b6d4",
    capabilities: {
      scoring: "quiz",
      rewardsSpeed: false,
      gameControlsCompletion: true,
    },
    curriculum: UNCLASSIFIED_CURRICULUM,
    quizType: QuizType.WORD_BRIDGES,
    challenges: [
      {
        challengeNumber: 1,
        title: "Runs as Written",
        mode: { kind: "fixed", questionCount: 8 },
        constraints: { bridgeTask: "validity", optionCount: 2 },
        stars: { one: 400, two: 700, three: 1000 },
      },
      {
        challengeNumber: 2,
        title: "Count the Bridges",
        mode: { kind: "fixed", questionCount: 8 },
        constraints: { bridgeTask: "count", optionCount: 4 },
        stars: { one: 400, two: 700, three: 1000 },
      },
      {
        challengeNumber: 3,
        title: "Choose the Bridge",
        mode: { kind: "fixed", questionCount: 8 },
        constraints: { bridgeTask: "repair", optionCount: 4 },
        stars: { one: 400, two: 700, three: 1000 },
      },
    ],
  },
  {
    id: "trace-paths",
    title: "Trace Paths",
    tagline: "Draw the hand path on the grid, in order.",
    accentColor: "#818cf8",
    // No quizType: there is no question pool and no option list here. The
    // round is a traced path, scored by the game itself.
    capabilities: {
      immersiveStage: true,
      requiresTouch: false,
      supportsTwoPointers: true,
      scoring: "performance",
    },
    curriculum: UNCLASSIFIED_CURRICULUM,
    // The ladder walks one axis at a time: one hand before two, route shown
    // before route remembered, one hop before a chain. Each challenge adds a
    // single new demand so a miss tells the player exactly what to work on.
    //
    // STAR THRESHOLDS ARE ON A DIFFERENT SCALE THAN THE QUIZ GAMES ABOVE. A quiz
    // round stacks a speed bonus and a streak multiplier on top of its base, so
    // its ceiling is several times questionCount. A performance round is priced
    // by `scoreTraceRound` and hard-capped at 100 points (quality is clamped to
    // 1), and the engine takes that number verbatim — no bonus, no multiplier.
    // So a fixed challenge's ceiling is exactly questionCount * 100, and every
    // threshold below is a fraction of THAT: 50% / 70% / 85%. Copying a quiz
    // ladder here is how the third star became unearnable on seven of eight
    // challenges. Challenge 8 is survival — it has no round count, so its ceiling is
    // open and its thresholds read as "how many clean rounds before three
    // misses" (7 / 12 / 18).
    challenges: [
      {
        challengeNumber: 1,
        title: "Touch the Route",
        mode: { kind: "fixed", questionCount: 6 },
        constraints: {
          handCount: 1,
          showRoute: true,
          traceStepCount: 1,
          toleranceScale: 1.3,
        },
        stars: { one: 300, two: 420, three: 510 },
      },
      {
        challengeNumber: 2,
        title: "Keep the Line",
        mode: { kind: "fixed", questionCount: 8 },
        constraints: {
          handCount: 1,
          showRoute: true,
          traceStepCount: 1,
          toleranceScale: 1,
        },
        stars: { one: 400, two: 560, three: 680 },
      },
      {
        challengeNumber: 3,
        title: "Remember the Route",
        mode: { kind: "fixed", questionCount: 8 },
        constraints: {
          handCount: 1,
          showRoute: false,
          traceStepCount: 1,
          toleranceScale: 1,
        },
        stars: { one: 400, two: 560, three: 680 },
      },
      {
        challengeNumber: 4,
        title: "Meet the Other Hand",
        mode: { kind: "fixed", questionCount: 8 },
        constraints: {
          handCount: 2,
          showRoute: true,
          traceStepCount: 1,
          toleranceScale: 1.1,
        },
        stars: { one: 400, two: 560, three: 680 },
      },
      {
        challengeNumber: 5,
        title: "Hold and Move",
        mode: { kind: "fixed", questionCount: 8 },
        constraints: {
          handCount: 2,
          showRoute: true,
          traceStepCount: 1,
          requireHold: true,
          toleranceScale: 1,
        },
        stars: { one: 400, two: 560, three: 680 },
      },
      {
        challengeNumber: 6,
        title: "Chain the Beats",
        mode: { kind: "fixed", questionCount: 8 },
        constraints: {
          handCount: 2,
          showRoute: true,
          traceStepCount: 3,
          toleranceScale: 1,
        },
        stars: { one: 400, two: 560, three: 680 },
      },
      {
        challengeNumber: 7,
        title: "Trace the Sequence",
        mode: { kind: "fixed", questionCount: 6 },
        constraints: {
          handCount: 2,
          showRoute: false,
          traceStepCount: 6,
          wordLength: 3,
          toleranceScale: 1,
        },
        stars: { one: 300, two: 420, three: 510 },
      },
      {
        challengeNumber: 8,
        title: "Survival",
        mode: { kind: "survival", maxMisses: 3 },
        constraints: {
          handCount: 2,
          showRoute: false,
          traceStepCount: 6,
          wordLength: 3,
          toleranceScale: 0.8,
        },
        stars: { one: 700, two: 1200, three: 1800 },
      },
    ],
  },
];

export function getGame(id: string): GameDefinition | undefined {
  return GAME_REGISTRY.find((g) => g.id === id);
}
