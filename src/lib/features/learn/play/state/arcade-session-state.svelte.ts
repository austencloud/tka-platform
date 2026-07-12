/**
 * Arcade session engine — THE single source of truth for a play session.
 * Discriminated-union phase FSM on runes. Games render questions and emit
 * QuizAnswerEvent; the engine scores, streaks, clocks, and completes.
 *
 * Replaces the deleted QuizSessionManager (which scored by coin flip) and the
 * QuizTab/QuizWorkspaceView dual-session split.
 */
import { getContext, setContext } from "svelte";
import type { QuizAnswerEvent } from "../../quiz/domain/models/quiz-models";
import type {
  AnswerRecord,
  ArcadeSessionResult,
  GameDefinition,
  LevelDefinition,
} from "../domain/arcade-types";
import { computeGrade, scoreAnswer } from "../domain/scoring";
import { computeStars } from "../domain/progression";

export type ArcadePhase =
  | { name: "hub" }
  | { name: "level-select"; game: GameDefinition }
  | { name: "playing"; game: GameDefinition; level: LevelDefinition }
  | { name: "results"; game: GameDefinition; level: LevelDefinition; result: ArcadeSessionResult };

/** Wall-clock-derived countdown tick — 250ms is frequent enough to feel live
 * without being a per-frame reactivity cost. */
const CLOCK_TICK_MS = 250;

export function createArcadeSession() {
  let phase = $state<ArcadePhase>({ name: "hub" });
  let score = $state(0);
  let streak = $state(0);
  let longestStreak = $state(0);
  let misses = $state(0);
  let records = $state<AnswerRecord[]>([]);
  let questionIndex = $state(0);
  let questionShownAt = 0; // ms epoch, not reactive
  let startedAt = 0;
  // countdown clock
  let timeRemaining = $state(0);
  let clockHandle: ReturnType<typeof setInterval> | null = null;

  // A plain recomputing getter, not $derived: $derived's cache only gets
  // invalidated by writes observed from within an active reactive context
  // (component effect/template). The engine itself mutates + reads `records`
  // synchronously outside any such context (and so does this factory's own
  // test suite, which calls it directly), so a cached $derived here goes
  // stale. A plain getter recomputes every read — cheap at this array size —
  // and stays correct in every caller context. Same pattern as
  // codex-explorer-state.svelte.ts's `gridModeEnum` getter.
  function computeAccuracy(): number {
    return records.length === 0
      ? 0
      : records.filter((r) => r.event.isCorrect).length / records.length;
  }

  function stopClock() {
    if (clockHandle !== null) {
      clearInterval(clockHandle);
      clockHandle = null;
    }
  }

  function startClock(totalSeconds: number) {
    timeRemaining = totalSeconds;
    clockHandle = setInterval(() => {
      const remaining = Math.max(0, totalSeconds - (Date.now() - startedAt) / 1000);
      timeRemaining = remaining;
      if (remaining <= 0) {
        complete();
      }
    }, CLOCK_TICK_MS);
  }

  function selectGame(game: GameDefinition) {
    phase = { name: "level-select", game };
  }

  function startLevel(game: GameDefinition, level: LevelDefinition) {
    stopClock();
    score = 0;
    streak = 0;
    longestStreak = 0;
    misses = 0;
    records = [];
    questionIndex = 0;
    questionShownAt = 0;
    timeRemaining = 0;
    startedAt = Date.now();
    phase = { name: "playing", game, level };
    if (level.mode.kind === "countdown") {
      startClock(level.mode.seconds);
    }
  }

  function markQuestionShown() {
    questionShownAt = Date.now();
  }

  function submitAnswer(event: QuizAnswerEvent) {
    if (phase.name !== "playing") return;
    const { level } = phase;

    const answerTimeMs = Date.now() - questionShownAt;
    const streakBefore = streak;
    const points = scoreAnswer({ isCorrect: event.isCorrect, answerTimeMs, streakBefore });

    streak = event.isCorrect ? streak + 1 : 0;
    longestStreak = Math.max(longestStreak, streak);
    if (!event.isCorrect) misses += 1;

    records.push({ event, answerTimeMs, pointsAwarded: points, streakAfter: streak });
    score += points;
    questionIndex += 1;

    const mode = level.mode;
    if (mode.kind === "fixed" && records.length >= mode.questionCount) {
      complete();
    } else if (mode.kind === "survival" && misses >= mode.maxMisses) {
      complete();
    }
    // countdown: clock owns completion
  }

  function complete() {
    if (phase.name !== "playing") return;
    stopClock();
    const { game, level } = phase;

    const correctCount = records.filter((r) => r.event.isCorrect).length;
    const totalCount = records.length;
    const accuracyFraction = computeAccuracy();
    // Legacy quiz convention (quiz-session-manager.ts): percentage 0-100,
    // rounded to 2 decimals — not the 0-1 fraction computeGrade expects.
    const accuracyPercentage = Math.round(accuracyFraction * 100 * 100) / 100;
    const grade = computeGrade(accuracyFraction);
    const starsEarned = computeStars(score, level.stars);
    const durationSeconds = (Date.now() - startedAt) / 1000;

    const result: ArcadeSessionResult = {
      gameId: game.id,
      levelNumber: level.levelNumber,
      score,
      correctCount,
      totalCount,
      accuracyPercentage,
      longestStreak,
      // No separate combo tracking exists yet — combo and streak are the same
      // underlying value per the spec's state list ("score, streak, combo,
      // clock"); bestCombo mirrors longestStreak until a distinct combo rule
      // is introduced.
      bestCombo: longestStreak,
      grade,
      starsEarned,
      isNewBest: false, // the progress store computes the real value (Task 3)
      durationSeconds,
      completedAt: new Date(),
    };

    phase = { name: "results", game, level, result };
  }

  function quitToHub() {
    stopClock();
    phase = { name: "hub" };
  }

  function backToLevels() {
    if (phase.name === "hub") return;
    const { game } = phase;
    stopClock();
    phase = { name: "level-select", game };
  }

  function destroy() {
    stopClock();
  }

  return {
    get phase() {
      return phase;
    },
    get score() {
      return score;
    },
    get streak() {
      return streak;
    },
    get longestStreak() {
      return longestStreak;
    },
    get misses() {
      return misses;
    },
    get records() {
      return records;
    },
    get questionIndex() {
      return questionIndex;
    },
    get timeRemaining() {
      return timeRemaining;
    },
    get accuracy() {
      return computeAccuracy();
    },
    selectGame,
    startLevel,
    markQuestionShown,
    submitAnswer,
    complete,
    quitToHub,
    backToLevels,
    destroy,
  };
}

export type ArcadeSession = ReturnType<typeof createArcadeSession>;

const KEY = Symbol("arcade-session");
export function setArcadeSessionContext(s: ArcadeSession) {
  setContext(KEY, s);
}
export function getArcadeSession(): ArcadeSession {
  const s = getContext<ArcadeSession>(KEY);
  if (!s) throw new Error("Arcade session context missing — PlayHub must set it");
  return s;
}
