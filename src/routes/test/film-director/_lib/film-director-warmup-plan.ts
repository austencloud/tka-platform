export const FILM_DIRECTOR_WARMUP_PASSES = 2;

export function createFilmDirectorWarmupPlan(
  shotCount: number,
  passes: number = FILM_DIRECTOR_WARMUP_PASSES
): number[] {
  const safeShotCount = Math.max(0, Math.floor(shotCount));
  if (safeShotCount === 0) return [];
  if (safeShotCount === 1) return [0];

  const safePasses = Math.max(1, Math.floor(passes));
  const shots = Array.from({ length: safeShotCount }, (_, index) => index);
  return [...Array.from({ length: safePasses }, () => shots).flat(), 0];
}

export function getFilmDirectorWarmupStepCount(shotCount: number): number {
  return Math.max(1, createFilmDirectorWarmupPlan(shotCount).length - 1);
}
