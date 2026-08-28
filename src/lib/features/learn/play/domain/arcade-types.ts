/**
 * Play Arcade domain types.
 *
 * A "game" is a registry entry with a ladder of challenges. A "challenge" pins the
 * question constraints, the win condition, and star thresholds. Session
 * results are computed by the engine (scoring.ts) — games never self-score
 * beyond reporting per-question correctness.
 */
import type { QuizType } from "../../quiz/domain/enums/quiz-enums";
import type { QuizAnswerEvent } from "../../quiz/domain/models/quiz-models";
import type { MajorLevel } from "@tka/domain";

export type GameId =
  | "pictograph-to-letter"
  | "letter-to-pictograph"
  | "valid-next"
  | "performer-word"
  | "speed-blitz"
  | "mandala-match"
  | "card-to-mandala"
  | "motion-to-mandala"
  | "word-bridges"
  | "trace-paths";

/**
 * What a game needs from the shell, declared up front so the shell never has
 * to sniff a game id to decide how to host it.
 *
 * `scoring` is the load-bearing one: "quiz" games hand the engine a
 * QuizAnswerEvent and let scoring.ts price it; "performance" games price their
 * own round (they are the only ones that can — correctness there is a
 * continuous trace quality, not a picked option) and hand over the points.
 */
export interface GameCapabilities {
  /** Wants the full stage — the shell drops question chrome and gets out of the way. */
  immersiveStage?: boolean;
  /** Genuinely unplayable without a touch/pointer surface (mouse-only is fine when false). */
  requiresTouch?: boolean;
  /** Tracks two simultaneous pointers; the shell must not swallow the second one. */
  supportsTwoPointers?: boolean;
  /** Who computes the round's points. See the note above. */
  scoring: "quiz" | "performance";
  /** False keeps quiz scoring accuracy-based instead of rewarding fast answers. */
  rewardsSpeed?: boolean;
  /** Lets a game keep final-answer feedback open until it explicitly completes. */
  gameControlsCompletion?: boolean;
}

export type BridgeTask = "validity" | "count" | "repair";

/**
 * A performance round's own metrics, carried through the engine untouched.
 *
 * Deliberately a type parameter defaulting to `unknown` rather than an import
 * of the trace game's `TraceMetrics`: the arcade is the host, the game is the
 * guest, so the dependency arrow has to point game -> arcade. A game keeps its
 * own strong metrics type at the call site (submitRound infers it); the engine
 * only stores and forwards, so `unknown` is all the engine ever needs to know.
 */
export type ArcadeRoundEvent<TMetrics = unknown> =
  | { kind: "choice"; answer: QuizAnswerEvent }
  | {
      kind: "performance";
      isCorrect: boolean;
      /** Already priced by the game (e.g. scoreTraceRound). The engine uses this verbatim. */
      points: number;
      /** Time the round actually took, measured by the game's own stage clock. */
      elapsedMs: number;
      metrics: TMetrics;
      /** Whatever the game needs to reconstruct the round for review. Never raw pointer traces. */
      questionData: Record<string, unknown>;
    };

/**
 * Correctness without narrowing. Both branches carry it — the choice branch
 * inside its QuizAnswerEvent, the performance branch at the top challenge — so
 * every reader (accuracy, misses, grade) goes through here instead of
 * duplicating the `kind` check.
 */
export function roundIsCorrect(round: ArcadeRoundEvent): boolean {
  return round.kind === "choice" ? round.answer.isCorrect : round.isCorrect;
}

/** Win condition: answer N questions, or survive a countdown clock. */
export type ChallengeMode =
  | { kind: "fixed"; questionCount: number }
  | { kind: "countdown"; seconds: number }
  | { kind: "survival"; maxMisses: number };

export interface QuestionConstraints {
  /** Restrict the question pool to these letters (registry uses @tka/domain groupings). */
  letters?: string[];
  /** Number of answer options to render (default 4). */
  optionCount?: number;
  /** Word length for sequence-based games (performer-word, mandala-match). */
  wordLength?: number;
  /** Escalation curve for speed-blitz: seconds allowed per question at start/end. */
  paceStartSeconds?: number;
  paceEndSeconds?: number;
  /** Sequence length for the mandala game family (8-count to start; raise for harder tiers). */
  stepCount?: number;
  /** Bridge-game question family for this challenge. */
  bridgeTask?: BridgeTask;

  // --- Performance (trace-paths) constraints ---------------------------
  // All optional: quiz games never set them, and the trace game reads them
  // with its own defaults so a half-specified challenge still plays.

  /** How many hands the round arms. 1 = one hand at a time, 2 = both together. */
  handCount?: 1 | 2;
  /** Route drawn on the stage while tracing. False = the player has to remember it. */
  showRoute?: boolean;
  /** How many path steps chain together inside one round. 1 = a single hop. */
  traceStepCount?: number;
  /**
   * Multiplier on the stage-relative tolerance corridor. 1 = the default
   * corridor, >1 forgives more, <1 tightens it. Never a pixel value — the
   * corridor is normalized to the stage so it survives any screen size.
   */
  toleranceScale?: number;
  /** One hand holds its point while the other travels. */
  requireHold?: boolean;
}

export interface StarThresholds {
  /** Minimum session score for 1/2/3 stars. */
  one: number;
  two: number;
  three: number;
}

export interface ChallengeDefinition {
  challengeNumber: number; // 1-based
  title: string;
  mode: ChallengeMode;
  constraints: QuestionConstraints;
  stars: StarThresholds;
}

/**
 * Curriculum placement is an editorial decision, never something inferred
 * from a game's question pool. A reviewed game can span official TKA levels,
 * attach to individual concepts, or both. Until that review happens the game
 * remains playable from the arcade but cannot be presented as level practice.
 */
export type GameCurriculumClassification =
  | { status: "unclassified" }
  | {
      status: "reviewed";
      tkaLevels: MajorLevel[];
      conceptIds: string[];
      evidence: string[];
    };

export interface GameDefinition {
  id: GameId;
  title: string;
  tagline: string;
  /** Local accent, consumed as var(--game-accent). Hex string from the shared palette. */
  accentColor: string;
  /**
   * Optional because a performance game has no QuizType — there is no question
   * pool and no option list to classify. Quiz games all set it; readers that
   * persist a quiz attempt should skip games that don't.
   */
  quizType?: QuizType;
  capabilities: GameCapabilities;
  curriculum: GameCurriculumClassification;
  challenges: ChallengeDefinition[];
}

/**
 * One completed round of any kind. This is the engine's own log — score,
 * streak, and completion all count these.
 */
export interface RoundRecord {
  round: ArcadeRoundEvent;
  /** Hoisted off `round` so readers never narrow just to count correct answers. */
  isCorrect: boolean;
  /** ms from question shown to answer (choice) or the game's own stage clock (performance). */
  answerTimeMs: number;
  pointsAwarded: number;
  streakAfter: number;
}

/**
 * A round that WAS a quiz answer, with the quiz event hoisted.
 *
 * The quiz-shaped consumers downstream (gap analysis, quiz-history
 * persistence) need a real QuizAnswerEvent per entry — a performance round has
 * no selected option, no correct option, and no QuizType to record. So
 * `session.records` stays this narrow quiz log and keeps its guarantee, while
 * `session.rounds` is the complete log that scoring and completion read.
 */
export interface AnswerRecord extends RoundRecord {
  round: { kind: "choice"; answer: QuizAnswerEvent };
  event: QuizAnswerEvent;
}

export interface ArcadeSessionResult {
  gameId: GameId;
  challengeNumber: number;
  score: number;
  correctCount: number;
  totalCount: number;
  accuracyPercentage: number;
  longestStreak: number;
  bestCombo: number;
  grade: Grade;
  starsEarned: 0 | 1 | 2 | 3;
  isNewBest: boolean;
  durationSeconds: number;
  completedAt: Date;
}

export type Grade = "S" | "A" | "B" | "C" | "D";

export interface GameProgress {
  bestScore: number;
  bestGrade: Grade | null;
  /** starsByChallenge["1"] = 0-3 */
  starsByChallenge: Record<string, 0 | 1 | 2 | 3>;
  challengesUnlocked: number; // highest unlocked challenge number
  totalPlays: number;
}

export interface PlayProgress {
  games: Partial<Record<GameId, GameProgress>>;
  lastUpdated: string; // ISO
}
