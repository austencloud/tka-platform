import { afterEach, describe, expect, it, vi } from "vitest";
import { createArcadeSession } from "$lib/features/learn/play/state/arcade-session-state.svelte";
import { scoreAnswer } from "$lib/features/learn/play/domain/scoring";
import type { GameDefinition, LevelDefinition } from "$lib/features/learn/play/domain/arcade-types";
import type { QuizAnswerEvent } from "$lib/features/learn/quiz/domain/models/quiz-models";

function evt(isCorrect: boolean): QuizAnswerEvent {
  return {
    isCorrect,
    questionData: {
      questionId: "q",
      questionContent: null,
      answerOptions: [],
      correctAnswer: null,
      questionType: "letter" as never,
      answerType: "button" as never,
      lessonType: "pictograph_to_letter" as never,
    },
    selectedOptionId: "a",
    selectedContent: null,
    correctContent: null,
    quizType: "pictograph_to_letter" as never,
    answeredAt: new Date(),
  };
}

const GAME: GameDefinition = {
  id: "pictograph-to-letter",
  title: "Name That Pictograph",
  tagline: "test",
  accentColor: "#000",
  quizType: "pictograph_to_letter" as never,
  levels: [],
};

function fixedLevel(questionCount: number): LevelDefinition {
  return {
    levelNumber: 1,
    title: "Test Level",
    mode: { kind: "fixed", questionCount },
    constraints: {},
    stars: { one: 100, two: 500, three: 1000 },
  };
}

function survivalLevel(maxMisses: number): LevelDefinition {
  return {
    levelNumber: 2,
    title: "Survival Level",
    mode: { kind: "survival", maxMisses },
    constraints: {},
    stars: { one: 100, two: 500, three: 1000 },
  };
}

function countdownLevel(seconds: number): LevelDefinition {
  return {
    levelNumber: 3,
    title: "Countdown Level",
    mode: { kind: "countdown", seconds },
    constraints: {},
    stars: { one: 100, two: 500, three: 1000 },
  };
}

describe("createArcadeSession", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("right answer increments score by scoreAnswer amount and streak by 1", () => {
    const session = createArcadeSession();
    session.startLevel(GAME, fixedLevel(5));
    session.markQuestionShown();

    const expected = scoreAnswer({ isCorrect: true, answerTimeMs: 0, streakBefore: 0 });
    session.submitAnswer(evt(true));

    expect(session.score).toBe(expected);
    expect(session.streak).toBe(1);
  });

  it("wrong answer zeros streak, increments misses, adds 0 points", () => {
    const session = createArcadeSession();
    session.startLevel(GAME, fixedLevel(5));
    session.markQuestionShown();
    session.submitAnswer(evt(true)); // build up a streak first
    expect(session.streak).toBe(1);

    session.markQuestionShown();
    session.submitAnswer(evt(false));

    expect(session.streak).toBe(0);
    expect(session.misses).toBe(1);
    expect(session.records.at(-1)?.pointsAwarded).toBe(0);
  });

  it("fixed mode completes after N answers with correct grade + stars", () => {
    const session = createArcadeSession();
    const level = fixedLevel(2);
    session.startLevel(GAME, level);

    session.markQuestionShown();
    session.submitAnswer(evt(true));
    expect(session.phase.name).toBe("playing");

    session.markQuestionShown();
    session.submitAnswer(evt(true));

    expect(session.phase.name).toBe("results");
    if (session.phase.name !== "results") throw new Error("unreachable");
    expect(session.phase.result.correctCount).toBe(2);
    expect(session.phase.result.totalCount).toBe(2);
    expect(session.phase.result.grade).toBe("S"); // 100% accuracy
    expect(session.phase.result.starsEarned).toBe(computeExpectedStars(session.score, level));
  });

  function computeExpectedStars(score: number, level: LevelDefinition): 0 | 1 | 2 | 3 {
    if (score >= level.stars.three) return 3;
    if (score >= level.stars.two) return 2;
    if (score >= level.stars.one) return 1;
    return 0;
  }

  it("survival completes at maxMisses", () => {
    const session = createArcadeSession();
    session.startLevel(GAME, survivalLevel(2));

    session.markQuestionShown();
    session.submitAnswer(evt(false));
    expect(session.phase.name).toBe("playing");
    expect(session.misses).toBe(1);

    session.markQuestionShown();
    session.submitAnswer(evt(false));

    expect(session.phase.name).toBe("results");
    if (session.phase.name !== "results") throw new Error("unreachable");
    expect(session.phase.result.correctCount).toBe(0);
    expect(session.phase.result.totalCount).toBe(2);
  });

  it("countdown completes when clock hits 0", () => {
    vi.useFakeTimers();
    const session = createArcadeSession();
    session.startLevel(GAME, countdownLevel(1));

    expect(session.phase.name).toBe("playing");
    expect(session.timeRemaining).toBe(1);

    vi.advanceTimersByTime(1100);

    expect(session.phase.name).toBe("results");
  });

  it("longestStreak survives a streak reset", () => {
    const session = createArcadeSession();
    session.startLevel(GAME, fixedLevel(10));

    session.markQuestionShown();
    session.submitAnswer(evt(true));
    session.markQuestionShown();
    session.submitAnswer(evt(true));
    session.markQuestionShown();
    session.submitAnswer(evt(true));
    expect(session.streak).toBe(3);
    expect(session.longestStreak).toBe(3);

    session.markQuestionShown();
    session.submitAnswer(evt(false));

    expect(session.streak).toBe(0);
    expect(session.longestStreak).toBe(3);
  });

  it("quitToHub stops the clock and returns to hub", () => {
    vi.useFakeTimers();
    const session = createArcadeSession();
    session.startLevel(GAME, countdownLevel(10));
    session.quitToHub();
    expect(session.phase.name).toBe("hub");

    // Advancing time after quitting must not resurrect a "results" phase.
    vi.advanceTimersByTime(11000);
    expect(session.phase.name).toBe("hub");
  });
});
