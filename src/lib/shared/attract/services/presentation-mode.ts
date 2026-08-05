/**
 * Presentation mode entry — opt-in, never automatic
 * (spec: 2026-08-04-ghost-mind-design.md §Safety).
 *
 * One way in: `?present=1` on any app route. The park laptop gets a bookmark;
 * nothing in the normal UI can trip it, and no visitor can start it by
 * accident. Under prefers-reduced-motion the mind does not mount at all,
 * matching the shipped attract acts.
 */

export const PRESENT_PARAM = "present";

function presentParam(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(PRESENT_PARAM);
}

const LATCH_KEY = "tka-presentation-mode";

/**
 * Once armed, presentation mode survives a full page load. Some navigations
 * (and any crash-reload over a long unattended run) drop the query string, and
 * a presenter that quietly stops after an hour at a jam has failed at the one
 * thing it was brought there to do. `?present=0` disarms it.
 */
export function isPresentationRequested(): boolean {
  const value = presentParam();
  if (value === "0" || value === "false") {
    try {
      sessionStorage.removeItem(LATCH_KEY);
    } catch {
      // Private-mode storage failures are not worth a broken boot.
    }
    return false;
  }

  let latched = false;
  try {
    latched = sessionStorage.getItem(LATCH_KEY) !== null;
    if (value !== null && !latched) sessionStorage.setItem(LATCH_KEY, value);
  } catch {
    latched = false;
  }

  if (value === null && !latched) return false;
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * `?present=stage` — the big read.
 *
 * Viewport width cannot tell a 1080p projector from a 1080p laptop, and the two
 * want opposite things: a laptop at arm's length wants a discreet pointer, a
 * projection screen fifteen feet away wants a presence. Every existing tier in
 * the ghost keys off `min-width: 2600px`, so a projector at a jam currently
 * gets the LAPTOP treatment, which is the worst case in the room.
 *
 * Rather than guess, one flag set once when the laptop is plugged in. The
 * laptop default stays the safe one; stage is purely additive.
 */
export function isStageMode(): boolean {
  let value = presentParam();
  if (value === null) {
    try {
      value = sessionStorage.getItem(LATCH_KEY);
    } catch {
      value = null;
    }
  }
  return value === "stage";
}

/**
 * `?present=1` runs a fresh random tour and logs its seed. Passing that seed
 * back (`?present=1234567`) replays the identical sequence of decisions, which
 * is the only reason the seeded RNG exists.
 */
export function requestedSeed(): number | undefined {
  let value = presentParam();
  if (value === null) {
    try {
      value = sessionStorage.getItem(LATCH_KEY);
    } catch {
      value = null;
    }
  }
  if (!value) return undefined;
  const seed = Number(value);
  return Number.isFinite(seed) && seed > 1 ? seed : undefined;
}
