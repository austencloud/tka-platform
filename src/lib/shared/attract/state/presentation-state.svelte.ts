/**
 * Presentation mode as reactive, persisted state.
 *
 * Two things pushed this out of `presentation-mode.ts`'s one-shot functions:
 *
 * 1. **The F9 admin panel turns the ghost on and off.** That needs a live
 *    switch, not a value read once at mount.
 * 2. **A hot reload must not put the ghost back to work behind Austen's back.**
 *    He asked for this directly (2026-08-05): "if the ghost is active and I
 *    click and then I'm interacting and then it reloads then the ghost should
 *    stay inactive due to the fact that I already interacted but if I click the
 *    play button then it should get back to work." The arming latch already
 *    survived reloads; whether the visitor had taken the wheel did not, so every
 *    HMR update handed it straight back to the ghost mid-keystroke.
 *
 * Both live in sessionStorage: per-tab, cleared when the tab closes, which is
 * the right lifetime for "this window is currently demonstrating itself".
 */

import {
  isPresentationRequested,
  requestedSeed,
} from "../services/presentation-mode";

/** Whether the visitor or the ghost currently has the wheel. */
export type PresenterActivity = "running" | "paused";

const ACTIVITY_KEY = "tka-presentation-activity";
const PAUSED_AT_KEY = "tka-presentation-paused-at";

function read(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    // Private-mode storage failures are not worth a broken boot.
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch {
    /* see read() */
  }
}

const state = $state({
  armed: false,
  seed: undefined as number | undefined,
  activity: "running" as PresenterActivity,
});

/**
 * Wall-clock, not performance.now(): it has to survive a page load to answer
 * "was the human here a moment ago, or is this a crash-reload from hours ago?"
 * Reads 0 when nothing is stored.
 */
function readPausedAt(): number {
  const raw = read(PAUSED_AT_KEY);
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) ? n : 0;
}

export const presentationState = {
  get armed() {
    return state.armed;
  },
  get seed() {
    return state.seed;
  },
  get activity() {
    return state.activity;
  },
  /** ms since the visitor last took the wheel, across reloads. Infinity if never. */
  get pausedForMs() {
    const at = readPausedAt();
    return at ? Date.now() - at : Infinity;
  },

  /**
   * Resolve arming at boot from the URL param and the sessionStorage latch, and
   * restore whether the ghost was running or parked when the page went away.
   */
  boot(): void {
    state.armed = isPresentationRequested();
    state.seed = requestedSeed();
    state.activity = read(ACTIVITY_KEY) === "paused" ? "paused" : "running";
  },

  /**
   * Turn the presenter on deliberately (the F9 admin button). Bypasses the
   * reduced-motion check that gates the URL path — someone pressing a button
   * labelled "Ghost" has asked for motion — and always starts running, because
   * pressing it while it is parked means "get back to work".
   */
  activate(seed?: number): void {
    write("tka-presentation-mode", String(seed ?? 1));
    state.seed = seed;
    this.markRunning();
    state.armed = true;
  },

  /** Turn it off and keep it off across reloads. */
  deactivate(): void {
    write("tka-presentation-mode", null);
    write(ACTIVITY_KEY, null);
    write(PAUSED_AT_KEY, null);
    state.armed = false;
    state.activity = "running";
  },

  markPaused(): void {
    state.activity = "paused";
    write(ACTIVITY_KEY, "paused");
    write(PAUSED_AT_KEY, String(Date.now()));
  },

  markRunning(): void {
    state.activity = "running";
    write(ACTIVITY_KEY, "running");
    write(PAUSED_AT_KEY, null);
  },
};
