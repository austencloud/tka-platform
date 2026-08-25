export const FILM_DIRECTOR_WARMUP_PASSES = 2;

export function createFilmDirectorWarmupPlan(
  sceneCount: number,
  passes: number = FILM_DIRECTOR_WARMUP_PASSES
): number[] {
  const safeSceneCount = Math.max(0, Math.floor(sceneCount));
  if (safeSceneCount === 0) return [];
  if (safeSceneCount === 1) return [0];

  const safePasses = Math.max(1, Math.floor(passes));
  const scenes = Array.from({ length: safeSceneCount }, (_, index) => index);
  return [...Array.from({ length: safePasses }, () => scenes).flat(), 0];
}

export function getFilmDirectorWarmupStepCount(sceneCount: number): number {
  return Math.max(1, createFilmDirectorWarmupPlan(sceneCount).length - 1);
}
