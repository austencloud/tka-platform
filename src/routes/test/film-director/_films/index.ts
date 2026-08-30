import type { FilmDirectorInput } from "../_lib/film-director-schema";
import { skyIsTheLimitFilm } from "./sky-is-the-limit";
import { ninePlanesFilm } from "./nine-planes";
import { understudyNightFilm } from "./understudy-night";
import { chanceSuiteFilm } from "./chance-suite";
import { starOfFiveFilm } from "./star-of-five";
import { breakTheStarFilm } from "./break-the-star";
import { figuresFilm } from "./figures";
import { emberFilm } from "./ember";

/**
 * The frame the marquee shows for a library film, and the cue that produced it.
 *
 * A saved film keeps its poster in its own document, captured from whatever the
 * user was looking at. A library film has no document to keep one in, so the
 * cue lives here and `scripts/build-film-posters.mjs` bakes `src` from it.
 *
 * The cue is scene-relative rather than an absolute timestamp so that editing
 * an earlier scene's duration does not silently re-aim every later poster.
 */
export interface FilmPosterCue {
  /** Served from `static/`. */
  src: string;
  /** Which scene to capture, by its resolved scene id. */
  sceneId: string;
  /** Seconds into that scene. Must land inside its duration. */
  offsetSeconds: number;
}

export interface FilmLibraryEntry {
  /** Stable picker value; matches the film's input id without the revision. */
  key: string;
  /** Short picker label. */
  label: string;
  film: FilmDirectorInput;
  poster: FilmPosterCue;
}

/**
 * Every film the workbench can load. The registry-wide resolution test
 * (tests/unit/film-director/film-library.test.ts) resolves each entry, so a
 * film that would reject at load time fails CI instead of the picker.
 */
export const FILM_LIBRARY: readonly FilmLibraryEntry[] = [
  {
    key: "sky",
    label: "Sky Is the Limit",
    film: skyIsTheLimitFilm,
    poster: {
      src: "/films/posters/sky.webp",
      sceneId: "ocean-bubbles",
      offsetSeconds: 5,
    },
  },
  {
    key: "planes",
    label: "Nine Planes",
    film: ninePlanesFilm,
    poster: {
      src: "/films/posters/planes.webp",
      sceneId: "shield-wall",
      offsetSeconds: 5,
    },
  },
  {
    key: "understudy",
    label: "Understudy Night",
    film: understudyNightFilm,
    poster: {
      src: "/films/posters/understudy.webp",
      sceneId: "mirror-pair",
      offsetSeconds: 4,
    },
  },
  {
    key: "chance",
    label: "Chance Suite",
    film: chanceSuiteFilm,
    poster: {
      src: "/films/posters/chance.webp",
      sceneId: "loaded-dice",
      offsetSeconds: 5,
    },
  },
  {
    key: "star",
    label: "Star of Five",
    film: starOfFiveFilm,
    poster: {
      src: "/films/posters/star.webp",
      sceneId: "star-reveal",
      offsetSeconds: 11,
    },
  },
  {
    key: "break",
    label: "Break the Star",
    film: breakTheStarFilm,
    poster: {
      src: "/films/posters/break.webp",
      sceneId: "star-to-line",
      // Mid-crossing, with all five in motion and none of them yet on the
      // line — the formed line at the end is a row like any other row, and
      // would not tell this film apart from Star of Five on the marquee.
      offsetSeconds: 9,
    },
  },
  {
    key: "figures",
    label: "Figures",
    film: figuresFilm,
    poster: {
      src: "/films/posters/figures.webp",
      sceneId: "the-hey",
      // Six seconds into the weave, partway up the crane: the four dancers are
      // still large enough to read their staffs, and the lit disc is centered.
      // Later in the crane the whole disc fits with margin, but the dancers
      // shrink to specks. The celestial films already on the marquee all read
      // as a lit stage with a row of people on it; this one does not.
      offsetSeconds: 6,
    },
  },
  {
    key: "ember",
    label: "Ember",
    film: emberFilm,
    poster: {
      src: "/films/posters/ember.webp",
      sceneId: "first-sparks",
      // Eight seconds in, the low orbit has settled: the apprentice is
      // mid-phrase in sparkles with both grids up, and the master has
      // finished his retreat and stands turned toward her. The fire finale
      // plays on the celestial stage, which the marquee already shows three
      // of; the ember practice room is this film's own light.
      offsetSeconds: 8,
    },
  },
];

export const DEFAULT_FILM_KEY = FILM_LIBRARY[0]!.key;

/** Whether a string names a film in the library — for URL and JSON input. */
export function isLibraryFilmKey(key: string): boolean {
  return FILM_LIBRARY.some((entry) => entry.key === key);
}

export function getLibraryFilm(key: string): FilmDirectorInput {
  return (
    FILM_LIBRARY.find((entry) => entry.key === key)?.film ?? FILM_LIBRARY[0]!.film
  );
}
