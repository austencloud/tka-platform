// src/routes/test/film-director/_lib/directive-random.ts
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

export function createAxisStream(
  seed: FilmSeed,
  shotId: string,
  axis: string
): () => number {
  const salt = seed.axes[axis] ?? 0;
  return mulberry32(hashString(`${seed.base}:${salt}:${shotId}:${axis}`));
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

export function seededPick<T>(items: readonly T[], random: () => number): T {
  return items[Math.floor(random() * items.length)]!;
}
