import {
  hashString,
  mulberry32,
} from "$lib/shared/3d/procedural-engine/generation/seed-generator";

export interface FilmSeed {
  base: number;
  /** Per-axis reroll salts — bumping one shuffles only that axis. */
  axes: Record<string, number>;
}

export interface FilmSeedInput {
  base?: number;
  axes?: Record<string, number>;
}

export function resolveFilmSeed(filmId: string, input?: FilmSeedInput): FilmSeed {
  return {
    base: input?.base ?? hashString(filmId),
    axes: { ...(input?.axes ?? {}) },
  };
}

/**
 * Draws from the returned generator are position-dependent within a given
 * (scene, axis): editing earlier picks in that scene+axis rerolls every later
 * one. The per-axis salt in `seed.axes` is the stable reroll knob — bump it
 * to reshuffle just that axis without disturbing anything else.
 */
export function createAxisStream(
  seed: FilmSeed,
  sceneId: string,
  axis: string
): () => number {
  return mulberry32(axisSeedValue(seed, sceneId, axis));
}

/**
 * The single number a (film, scene, axis) hashes to. `createAxisStream` turns
 * it into a generator; an axis that wants one stable value rather than a
 * sequence of draws (handheld's noise phases) takes the number directly.
 */
export function axisSeedValue(
  seed: FilmSeed,
  sceneId: string,
  axis: string
): number {
  const salt = seed.axes[axis] ?? 0;
  // Field values (e.g. axis names like "effectPreset:${effectId}") may
  // themselves contain ":", so a colon-joined key is ambiguous. NUL can't
  // appear in authored ids, so it's a safe unambiguous separator.
  return hashString(`${seed.base}\u0000${salt}\u0000${sceneId}\u0000${axis}`);
}

export function seededShuffle<T>(
  items: readonly T[],
  random: () => number
): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap]!, result[index]!];
  }
  return result;
}

export function seededPick<T>(
  items: readonly T[],
  random: () => number
): T | undefined {
  if (items.length === 0) return undefined;
  return items[Math.floor(random() * items.length)];
}
