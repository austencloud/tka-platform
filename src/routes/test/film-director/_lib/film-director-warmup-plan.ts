export const FILM_DIRECTOR_WARMUP_PASSES = 2;

/**
 * The order of scenes the curtain walks before the film is allowed to play.
 *
 * Every entry costs a full environment mount, so this plan is the entire boot
 * price. A film opened whole pays for each scene twice, which is what makes the
 * first cut land clean. A film opened on ONE scene pays for that scene only:
 * an address that names a scene asked for one capability, and charging 49
 * mounts to watch eight seconds is the wrong trade. The cost of that choice is
 * that leaving solo afterwards meets each remaining scene cold the first time
 * it is cut to.
 */
export function createFilmDirectorWarmupPlan(
  sceneCount: number,
  passes: number = FILM_DIRECTOR_WARMUP_PASSES,
  soloSceneIndex: number | null = null
): number[] {
  const safeSceneCount = Math.max(0, Math.floor(sceneCount));
  if (safeSceneCount === 0) return [];

  if (
    soloSceneIndex !== null &&
    Number.isInteger(soloSceneIndex) &&
    soloSceneIndex >= 0 &&
    soloSceneIndex < safeSceneCount
  ) {
    return [soloSceneIndex];
  }

  if (safeSceneCount === 1) return [0];

  const safePasses = Math.max(1, Math.floor(passes));
  const scenes = Array.from({ length: safeSceneCount }, (_, index) => index);
  return [...Array.from({ length: safePasses }, () => scenes).flat(), 0];
}

export function getFilmDirectorWarmupStepCount(
  sceneCount: number,
  soloSceneIndex: number | null = null
): number {
  return Math.max(
    1,
    createFilmDirectorWarmupPlan(
      sceneCount,
      FILM_DIRECTOR_WARMUP_PASSES,
      soloSceneIndex
    ).length - 1
  );
}
