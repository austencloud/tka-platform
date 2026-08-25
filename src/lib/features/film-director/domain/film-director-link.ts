/**
 * Where a film opens, and the `?film=` grammar that names one.
 *
 * The Director's document types, resolver, and scene still live under
 * `src/routes/test/film-director/_lib`, where the `_` prefix marks them private
 * to the route. Linking INTO the Director is the first piece that has to be
 * reachable from `src/lib` — the Library's Art shelf opens a saved film without
 * knowing anything else about the Director — so the grammar moved out here
 * ahead of the rest.
 *
 * One owner for the whole grammar, not a split: the route supplies the
 * library-key predicate rather than keeping half the parser. The route constant
 * lives here too, so retiring `/test/` is one edit.
 */

export const FILM_DIRECTOR_ROUTE = "/test/film-director";

/**
 * Saved ids are opaque Firestore document ids, so a prefix is the only thing
 * keeping them from shadowing a library key the day someone saves a film whose
 * id is "star".
 */
export const SAVED_FILM_PREFIX = "saved:";

/** A `?film=` value, resolved to what it points at. */
export type FilmKey =
  | { kind: "library"; key: string }
  | { kind: "saved"; id: string }
  | { kind: "unknown" };

/** The `?film=` value for a saved entry. */
export function savedFilmKey(id: string): string {
  return `${SAVED_FILM_PREFIX}${id}`;
}

/** A link that opens one saved film on the Director's stage. */
export function savedFilmHref(id: string): string {
  return `${FILM_DIRECTOR_ROUTE}?film=${encodeURIComponent(savedFilmKey(id))}`;
}

/**
 * Read a `?film=` value.
 *
 * `isLibraryKey` comes from the caller because the built-in film registry is
 * still route-private; everything else about the grammar is decided here.
 */
export function parseFilmKey(
  raw: string | null | undefined,
  isLibraryKey: (key: string) => boolean
): FilmKey {
  if (!raw) return { kind: "unknown" };

  if (raw.startsWith(SAVED_FILM_PREFIX)) {
    const id = raw.slice(SAVED_FILM_PREFIX.length);
    return id ? { kind: "saved", id } : { kind: "unknown" };
  }

  return isLibraryKey(raw) ? { kind: "library", key: raw } : { kind: "unknown" };
}
