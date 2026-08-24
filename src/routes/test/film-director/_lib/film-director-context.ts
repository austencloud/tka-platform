import { getContext, setContext } from "svelte";

import type { FilmDirectorState } from "./film-director-state.svelte";

const FILM_DIRECTOR_CONTEXT = Symbol("film-director");

export function setFilmDirectorContext(state: FilmDirectorState): void {
  setContext(FILM_DIRECTOR_CONTEXT, state);
}

export function getFilmDirectorContext(): FilmDirectorState {
  return getContext<FilmDirectorState>(FILM_DIRECTOR_CONTEXT);
}
