/**
 * Play Arcade domain types.
 *
 * A "game" is a registry entry with a ladder of levels. A "level" pins the
 * question constraints, the win condition, and star thresholds. Session
 * results are computed by the engine (scoring.ts) — games never self-score
 * beyond reporting per-question correctness.
 */
import type { QuizType } from "../../quiz/domain/enums/quiz-enums";
import type { QuizAnswerEvent } from "../../quiz/domain/models/quiz-models";

export type GameId =
  | "pictograph-to-letter"
  | "letter-to-pictograph"
  | "valid-next"
  | "performer-word"
  | "speed-blitz"
  | "mandala-match"
  | "card-to-mandala"
  | "motion-to-mandala";

/** Win condition: answer N questions, or survive a countdown clock. */
export type LevelMode =
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
}

export interface StarThresholds {
  /** Minimum session score for 1/2/3 stars. */
  one: number;
  two: number;
  three: number;
}

export interface LevelDefinition {
  levelNumber: number; // 1-based
  title: string;
  mode: LevelMode;
  constraints: QuestionConstraints;
  stars: StarThresholds;
}

export interface GameDefinition {
  id: GameId;
  title: string;
  tagline: string;
  /** Local accent, consumed as var(--game-accent). Hex string from the shared palette. */
  accentColor: string;
  quizType: QuizType;
  levels: LevelDefinition[];
}

export interface AnswerRecord {
  event: QuizAnswerEvent;
  /** ms from question shown to answer. */
  answerTimeMs: number;
  pointsAwarded: number;
  streakAfter: number;
}

export interface ArcadeSessionResult {
  gameId: GameId;
  levelNumber: number;
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
  /** starsByLevel["1"] = 0-3 */
  starsByLevel: Record<string, 0 | 1 | 2 | 3>;
  levelsUnlocked: number; // highest unlocked level number
  totalPlays: number;
}

export interface PlayProgress {
  games: Partial<Record<GameId, GameProgress>>;
  lastUpdated: string; // ISO
}
