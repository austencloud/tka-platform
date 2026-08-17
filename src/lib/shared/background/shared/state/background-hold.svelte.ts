/**
 * BackgroundHold
 * Domain: Short-window freezing of the animated background's render loop
 *
 * The @austencloud/backgrounds controller repaints a viewport-sized canvas on
 * every frame. That is affordable while the page is sitting still and it is not
 * affordable while something in the foreground is animating: the app already
 * measured 37.9fps with 40.7% hitch frames during playback with the loop
 * running, against 59.9fps and 0.1% with it stopped (see BackgroundHost's
 * `pauseDuringPlayback`). A CSS panel transition has the same problem in a much
 * shorter window.
 *
 * A hold stops the loop and leaves the last painted frame on the canvas, so a
 * decorative backdrop holds still for the couple of hundred milliseconds the
 * interface is moving. Nobody looks at the backdrop during a transition; they
 * look at the thing that is moving, which is exactly the thing that wants the
 * frame budget.
 *
 * This is NOT background-suppression.svelte.ts. That unmounts the controller —
 * disposing systems and canvases — which is right for a fullscreen scene
 * occluding the backdrop for minutes and catastrophic for 280ms, where the
 * re-initialization costs more than the jank it was meant to avoid.
 *
 * Holds are keyed and refcounted: two overlapping transitions cannot unfreeze
 * each other early, and a released key is idempotent.
 */

import { browser } from "$app/environment";
import { getBackgroundController } from "@austencloud/backgrounds";

/**
 * The freeze/unfreeze pair landed in @austencloud/backgrounds after the version
 * this app pins, so the controller is used through its public API when the
 * installed copy has it and through its animation-frame handles when it does
 * not. Delete the fallback — and this type — once the dependency is on a
 * version that ships `freeze`.
 */
interface FreezableController {
  freeze?: () => void;
  unfreeze?: () => void;
  setQuality?: (quality: "low" | "medium" | "high") => void;
}

/**
 * What the older pinned version can do instead. Dropping the background to its
 * cheapest quality for the window is not as good as stopping it — the loop
 * still runs — but it is reversible through the same public API that set it,
 * which the animation-frame handles are not. A backdrop that never comes back
 * to life is a worse bug than the stutter this is here to fix.
 */
const HOLD_QUALITY = "low" as const;
const RESUME_QUALITY = "medium" as const;

const heldKeys = new Set<string>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function controller(): FreezableController | null {
  if (!browser) return null;
  return getBackgroundController() as unknown as FreezableController;
}

function applyFreeze(): void {
  const c = controller();
  if (!c) return;

  if (typeof c.freeze === "function") {
    c.freeze();
    return;
  }

  c.setQuality?.(HOLD_QUALITY);
}

function applyUnfreeze(): void {
  const c = controller();
  if (!c) return;

  if (typeof c.unfreeze === "function") {
    c.unfreeze();
    return;
  }

  // The controller's own adaptive-quality manager owns the steady-state level
  // and will raise or lower it again from its next sample, so handing back the
  // default is enough — this must not try to remember a level the manager may
  // have changed underneath it.
  c.setQuality?.(RESUME_QUALITY);
}

/** Hold the background still. Idempotent for the same key. */
export function holdBackground(key: string): void {
  const timer = timers.get(key);
  if (timer !== undefined) {
    clearTimeout(timer);
    timers.delete(key);
  }

  const wasEmpty = heldKeys.size === 0;
  heldKeys.add(key);
  if (wasEmpty) applyFreeze();
}

/** Release a hold. The loop resumes only once every key has released. */
export function releaseBackground(key: string): void {
  const timer = timers.get(key);
  if (timer !== undefined) {
    clearTimeout(timer);
    timers.delete(key);
  }

  if (!heldKeys.delete(key)) return;
  if (heldKeys.size === 0) applyUnfreeze();
}

/**
 * Hold the background still for a fixed window — the shape a CSS transition
 * wants, since it has a known duration and no completion callback worth
 * wiring. Re-arming the same key extends the window rather than stacking, so a
 * user toggling a panel repeatedly gets one continuous hold instead of a
 * backdrop that stutters back to life between clicks.
 *
 * The window is deliberately a little longer than the transition it covers:
 * the last frame of a transition is the one most worth protecting, and a
 * backdrop that restarts a frame early undoes the point of the hold.
 */
export function holdBackgroundFor(key: string, durationMs: number): void {
  holdBackground(key);
  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key);
      releaseBackground(key);
    }, durationMs)
  );
}
