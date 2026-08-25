import { isLibraryFilmKey } from "../_films/index";

/** A `?film=` value, resolved to what it points at. */
export type FilmKey =
  | { kind: "library"; key: string }
  | { kind: "saved"; id: string }
  | { kind: "unknown" };

const SAVED_PREFIX = "saved:";

/**
 * Read a `?film=` value.
 *
 * `saved:<id>` names an entry in the user's collection; a bare key names a
 * library film. Saved ids are opaque Firestore document ids, so the prefix is
 * what separates the two namespaces — without it a saved id could shadow a
 * library key the day someone names a film "star".
 */
export function parseFilmKey(raw: string | null | undefined): FilmKey {
  if (!raw) return { kind: "unknown" };

  if (raw.startsWith(SAVED_PREFIX)) {
    const id = raw.slice(SAVED_PREFIX.length);
    return id ? { kind: "saved", id } : { kind: "unknown" };
  }

  return isLibraryFilmKey(raw) ? { kind: "library", key: raw } : { kind: "unknown" };
}

/** The `?film=` value for a saved entry. */
export function savedFilmKey(id: string): string {
  return `${SAVED_PREFIX}${id}`;
}
