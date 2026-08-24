import type { FilmDirectorInput } from "../_lib/film-director-schema";
import { skyIsTheLimitFilm } from "./sky-is-the-limit";
import { ninePlanesFilm } from "./nine-planes";
import { understudyNightFilm } from "./understudy-night";
import { chanceSuiteFilm } from "./chance-suite";

export interface FilmLibraryEntry {
  /** Stable picker value; matches the film's input id without the revision. */
  key: string;
  /** Short picker label. */
  label: string;
  film: FilmDirectorInput;
}

/**
 * Every film the workbench can load. The registry-wide resolution test
 * (tests/unit/film-director/film-library.test.ts) resolves each entry, so a
 * film that would reject at load time fails CI instead of the picker.
 */
export const FILM_LIBRARY: readonly FilmLibraryEntry[] = [
  { key: "sky", label: "Sky Is the Limit", film: skyIsTheLimitFilm },
  { key: "planes", label: "Nine Planes", film: ninePlanesFilm },
  { key: "understudy", label: "Understudy Night", film: understudyNightFilm },
  { key: "chance", label: "Chance Suite", film: chanceSuiteFilm },
];

export const DEFAULT_FILM_KEY = FILM_LIBRARY[0]!.key;

export function getLibraryFilm(key: string): FilmDirectorInput {
  return (
    FILM_LIBRARY.find((entry) => entry.key === key)?.film ?? FILM_LIBRARY[0]!.film
  );
}
