/**
 * Starting Thursday over from a link.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The sim already had a way back to the beginning — the compass button opens
 * the utility drawer, and "Back to the loadout" calls the `start-over` action.
 * That only helps someone already looking at the drawer. Austen, 2026-09-05:
 * "I need a simple way to start the game over and or just have you link me to
 * the beginning of the game with the car ... I already got out of my car and
 * now I'm in the festival so I can't see what you just did."
 *
 * A saved session is sticky by design: park the car, walk into the festival,
 * and every later load resumes there. Handing someone a plain route link is
 * therefore not the same as handing them the drive-in, which is the part most
 * worth looking at. `?restart=1` closes that gap.
 *
 * ONE OWNER FOR THE KEYS
 * ----------------------
 * The session keys used to be six local constants in `+page.svelte`. A restart
 * that clears five of six is worse than no restart at all, because the survivor
 * silently resurrects the old run, so the list lives here and the page reads it
 * from this module. Adding a session key means adding it to this list.
 *
 * SELF-CANCELLING
 * ---------------
 * The parameter is stripped from the address bar the moment it is honoured. A
 * restart link that stayed in the URL would wipe the session again on every
 * refresh, which turns a bookmark into a trap.
 */

/** Progress for the original Thursday walk. */
export const FLOW_FEST_SESSION_KEY = "flow-fest-sim:thursday-session:v1";
/** Progress for the gate 4 fire-jam review. */
export const FLOW_FEST_GATE4_SESSION_KEY = "flow-fest-sim:gate4-fire-jam:v3";
/** Wheel and car for the gate 4 review. */
export const FLOW_FEST_GATE4_MOBILITY_SESSION_KEY = "flow-fest-sim:gate4-euc:v3";
/** Progress for the integrated world, which is the default entry. */
export const FLOW_FEST_GATE5_SESSION_KEY =
  "flow-fest-sim:gate5-integrated-world:v1";
/** Wheel and car for the integrated world. */
export const FLOW_FEST_GATE5_MOBILITY_SESSION_KEY = "flow-fest-sim:gate5-euc:v1";
/** Arrival-journey beats for the integrated world. */
export const FLOW_FEST_GATE5_JOURNEY_SESSION_KEY =
  "flow-fest-sim:gate5-journey:v1";

/**
 * Every key that holds Thursday-session state. Clearing all of them is what a
 * restart means: the next load rebuilds progress from `createFlowFestProgress`,
 * which opens on the loadout with no car packed.
 */
export const FLOW_FEST_SESSION_STORAGE_KEYS = [
  FLOW_FEST_SESSION_KEY,
  FLOW_FEST_GATE4_SESSION_KEY,
  FLOW_FEST_GATE4_MOBILITY_SESSION_KEY,
  FLOW_FEST_GATE5_SESSION_KEY,
  FLOW_FEST_GATE5_MOBILITY_SESSION_KEY,
  FLOW_FEST_GATE5_JOURNEY_SESSION_KEY,
] as const;

/** The query parameter that asks for a fresh Thursday. */
export const FLOW_FEST_RESTART_PARAMETER = "restart";

/**
 * True when a link asks the sim to start over.
 *
 * `?restart` with no value counts. Someone hand-trimming a URL down to the bare
 * flag means the same thing as `?restart=1`, and refusing them is pedantry. An
 * explicit `0` or `false` does not count, so a link can carry the parameter
 * switched off.
 */
export function parseFlowFestRestartRequest(query: URLSearchParams): boolean {
  if (!query.has(FLOW_FEST_RESTART_PARAMETER)) return false;
  const raw = (query.get(FLOW_FEST_RESTART_PARAMETER) ?? "").trim().toLowerCase();
  return raw !== "0" && raw !== "false";
}

/**
 * Forget every stored Thursday session.
 *
 * Takes the storage rather than reaching for `localStorage`, so a caller that
 * has no DOM can hand in its own and this stays testable. A storage that throws
 * — Safari private mode, a blocked third-party context — must not take the page
 * down with it: a restart that cannot clear still lands on a playable sim.
 */
export function clearFlowFestSessionStorage(
  storage: Pick<Storage, "removeItem">
): void {
  for (const key of FLOW_FEST_SESSION_STORAGE_KEYS) {
    try {
      storage.removeItem(key);
    } catch {
      // A storage that refuses to forget is not a reason to refuse to load.
    }
  }
}

/**
 * The same URL with the restart flag taken back out.
 *
 * Every other parameter survives, so `?restart=1&gate6=1` still reviews gate 6
 * and a shared viewpoint still lands on its frame.
 */
export function flowFestUrlWithoutRestart(current: URL): URL {
  const next = new URL(current.href);
  next.searchParams.delete(FLOW_FEST_RESTART_PARAMETER);
  return next;
}
