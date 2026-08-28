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
  ArcadeRoundEvent,
  ArcadeSessionResult,
  GameDefinition,
  ChallengeDefinition,
  RoundRecord,
} from "../domain/arcade-types";
import { roundIsCorrect } from "../domain/arcade-types";
import { computeGrade, scoreAnswer } from "../domain/scoring";
import { computeStars } from "../domain/progression";

export type ArcadePhase =
  | { name: "hub" }
  | { name: "challenge-select"; game: GameDefinition }
  | { name: "playing"; game: GameDefinition; challenge: ChallengeDefinition }
  | {
      name: "results";
      game: GameDefinition;
      challenge: ChallengeDefinition;
      result: ArcadeSessionResult;
    };

/** Wall-clock-derived countdown tick — 250ms is frequent enough to feel live
 * without being a per-frame reactivity cost. */
const CLOCK_TICK_MS = 250;

export function createArcadeSession() {
  let phase = $state<ArcadePhase>({ name: "hub" });
  let score = $state(0);
  let streak = $state(0);
  let longestStreak = $state(0);
  let misses = $state(0);
  // Two views of the same session, never out of sync: `rounds` is every round
  // of any kind (what scoring, accuracy and completion count), `records` is the
  // subset that were quiz answers (what gap analysis and quiz-history
  // persistence read, both of which need a real QuizAnswerEvent). In a
  // quiz-only session the two are element-for-element the same length.
  let rounds = $state<RoundRecord[]>([]);
  let records = $state<AnswerRecord[]>([]);
  let questionIndex = $state(0);
  // The deck cursor advances as soon as an answer is scored, while this
  // presentation cursor advances only when the next question is on screen.
  // Keeping them separate prevents feedback for question 1 from reading 2/8.
  let presentedQuestionIndex = $state(0);
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
    return rounds.length === 0
      ? 0
      : rounds.filter((r) => r.isCorrect).length / rounds.length;
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
      const remaining = Math.max(
        0,
        totalSeconds - (Date.now() - startedAt) / 1000
      );
      timeRemaining = remaining;
      if (remaining <= 0) {
        complete();
      }
    }, CLOCK_TICK_MS);
  }

  function selectGame(game: GameDefinition) {
    phase = { name: "challenge-select", game };
  }

  function startChallenge(
    game: GameDefinition,
    challenge: ChallengeDefinition
  ) {
    stopClock();
    score = 0;
    streak = 0;
    longestStreak = 0;
    misses = 0;
    rounds = [];
    records = [];
    questionIndex = 0;
    presentedQuestionIndex = 0;
    questionShownAt = 0;
    timeRemaining = 0;
    startedAt = Date.now();
    phase = { name: "playing", game, challenge };
    if (challenge.mode.kind === "countdown") {
      startClock(challenge.mode.seconds);
    }
  }

  function markQuestionShown() {
    presentedQuestionIndex = questionIndex;
    questionShownAt = Date.now();
  }

  /**
   * The quiz games' entry point, unchanged in behaviour. It is now a thin
   * adapter onto submitRound — every one of the eight quiz games keeps calling
   * this and gets byte-identical scoring.
   */
  function submitAnswer(event: QuizAnswerEvent) {
    submitRound({ kind: "choice", answer: event });
  }

  /**
   * The general round intake. Choice rounds are priced here by scoring.ts;
   * performance rounds arrive already priced by the game.
   *
   * Two things deliberately do NOT apply to performance points:
   *
   * - No speed bonus. The game's own scorer already weighed how the round
   *   went, and a trace is judged on where the hands went, not how fast.
   * - No streak multiplier. This is the deliberate-practice call: multiplying
   *   a traced round by a streak would make a late slip cost several times
   *   what an early one costs, which is exactly the pressure to rush that
   *   this game exists to remove. The streak still TRACKS (it drives the
   *   longest-streak stat and the shell's streak flourish) — it just doesn't
   *   scale the points.
   */
  function submitRound<TMetrics>(event: ArcadeRoundEvent<TMetrics>) {
    if (phase.name !== "playing") return;
    const { game, challenge } = phase;

    const isCorrect = roundIsCorrect(event);
    const answerTimeMs =
      event.kind === "performance"
        ? event.elapsedMs
        : Date.now() - questionShownAt;
    const streakBefore = streak;
    const points =
      event.kind === "performance"
        ? event.points
        : scoreAnswer({
            isCorrect,
            answerTimeMs,
            streakBefore,
            rewardsSpeed: game.capabilities.rewardsSpeed,
          });

    streak = isCorrect ? streak + 1 : 0;
    longestStreak = Math.max(longestStreak, streak);
    if (!isCorrect) misses += 1;

    const record = {
      round: event,
      isCorrect,
      answerTimeMs,
      pointsAwarded: points,
      streakAfter: streak,
    };
    rounds.push(record);
    if (event.kind === "choice") {
      records.push({ ...record, round: event, event: event.answer });
    }
    score += points;
    questionIndex += 1;

    const mode = challenge.mode;
    if (
      mode.kind === "fixed" &&
      rounds.length >= mode.questionCount &&
      !game.capabilities.gameControlsCompletion
    ) {
      complete();
    } else if (
      mode.kind === "survival" &&
      misses >= mode.maxMisses &&
      !game.capabilities.gameControlsCompletion
    ) {
      complete();
    }
    // countdown: clock owns completion
  }

  function complete() {
    if (phase.name !== "playing") return;
    stopClock();
    const { game, challenge } = phase;

    const correctCount = rounds.filter((r) => r.isCorrect).length;
    const totalCount = rounds.length;
    const accuracyFraction = computeAccuracy();
    // Legacy quiz convention (quiz-session-manager.ts): percentage 0-100,
    // rounded to 2 decimals — not the 0-1 fraction computeGrade expects.
    const accuracyPercentage = Math.round(accuracyFraction * 100 * 100) / 100;
    const grade = computeGrade(accuracyFraction);
    const starsEarned = computeStars(score, challenge.stars);
    const durationSeconds = (Date.now() - startedAt) / 1000;

    const result: ArcadeSessionResult = {
      gameId: game.id,
      challengeNumber: challenge.challengeNumber,
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

    phase = { name: "results", game, challenge, result };
  }

  function quitToHub() {
    stopClock();
    phase = { name: "hub" };
  }

  function backToChallenges() {
    if (phase.name === "hub") return;
    const { game } = phase;
    stopClock();
    phase = { name: "challenge-select", game };
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
    /** Quiz answers only. Read this when you need a QuizAnswerEvent per entry. */
    get records() {
      return records;
    },
    /** Every round, quiz or performance. Read this for "did they play anything". */
    get rounds() {
      return rounds;
    },
    get questionIndex() {
      return questionIndex;
    },
    get presentedQuestionIndex() {
      return presentedQuestionIndex;
    },
    get timeRemaining() {
      return timeRemaining;
    },
    get accuracy() {
      return computeAccuracy();
    },
    selectGame,
    startChallenge,
    markQuestionShown,
    submitAnswer,
    submitRound,
    complete,
    quitToHub,
    backToChallenges,
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
  if (!s)
    throw new Error("Arcade session context missing — PlayHub must set it");
  return s;
}
