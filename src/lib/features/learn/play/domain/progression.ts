/**
 * Pure progression rules: stars from score thresholds, best-tracking,
 * challenge unlocks (>=1 star unlocks the next challenge), lastUpdated-wins merge.
 */
import type {
  GameProgress,
  Grade,
  PlayProgress,
  StarThresholds,
} from "./arcade-types";

export function computeStars(score: number, t: StarThresholds): 0 | 1 | 2 | 3 {
  if (score >= t.three) return 3;
  if (score >= t.two) return 2;
  if (score >= t.one) return 1;
  return 0;
}

const GRADE_ORDER: Grade[] = ["D", "C", "B", "A", "S"];

export function betterGrade(a: Grade | null, b: Grade): Grade {
  if (a === null) return b;
  return GRADE_ORDER.indexOf(b) > GRADE_ORDER.indexOf(a) ? b : a;
}

export function emptyGameProgress(): GameProgress {
  return {
    bestScore: 0,
    bestGrade: null,
    starsByChallenge: {},
    challengesUnlocked: 1,
    totalPlays: 0,
  };
}

export function applyResult(
  progress: GameProgress,
  result: {
    challengeNumber: number;
    score: number;
    starsEarned: 0 | 1 | 2 | 3;
    grade: Grade;
  }
): GameProgress {
  const key = String(result.challengeNumber);
  const prevStars = progress.starsByChallenge[key] ?? 0;
  const starsByChallenge = {
    ...progress.starsByChallenge,
    [key]: Math.max(prevStars, result.starsEarned) as 0 | 1 | 2 | 3,
  };
  const unlocked =
    result.starsEarned >= 1
      ? Math.max(progress.challengesUnlocked, result.challengeNumber + 1)
      : progress.challengesUnlocked;
  return {
    bestScore: Math.max(progress.bestScore, result.score),
    bestGrade: betterGrade(progress.bestGrade, result.grade),
    starsByChallenge,
    challengesUnlocked: unlocked,
    totalPlays: progress.totalPlays + 1,
  };
}

export function mergeProgress(a: PlayProgress, b: PlayProgress): PlayProgress {
  return a.lastUpdated >= b.lastUpdated ? a : b;
}
