import { getContext, setContext } from "svelte";

const GUIDE_ACTIVE_STEP_KEY = Symbol("guide-active-step");

/**
 * Reactive bridge between the reader's animation companion (right pane) and the
 * on-screen sequence strip on the page (centre pane). While the companion
 * animates a clicked strip, the player reports its live `currentStep` up here;
 * the page strip reads `ringStep` to draw the golden ring on the matching cell.
 *
 * This mirrors the Sequence Viewer dual view, where one shared `playback` state
 * feeds `highlightedStepIndex` into the choreo card so the active step rings in
 * time with the animation. The reader splits animation and strip across two
 * independent panes (the companion owns its own AnimationPanelState), so that
 * coupling can't fall out for free — this signal reconnects them.
 *
 * `key` scopes the ring to exactly the strip that's playing (every wired page
 * hands up a unique `page-strip` key), so only that one strip rings, never both
 * strips on a page and never a strip on another (all pages are mounted at once
 * in the continuous scroller).
 */
export class GuideActiveStep {
  /** Identity of the strip currently animating (`"<page>-<stripIndex>"`); null = nothing rings. */
  key = $state<string | null>(null);
  /** Live 1-based fractional step from the companion (currentStep). `< 1` = the start pose. */
  step = $state(0);

  /**
   * The integer step number the ring sits on. The companion's `currentStep` is
   * 1-based and fractional (beat n spans `[n, n+1)`); `< 1` is the pre-beat-1
   * start pose, which rings the Start box (step 0).
   */
  get ringStep(): number {
    return this.step < 1 ? 0 : Math.floor(this.step);
  }

  /** A new strip started animating — ring its Start box immediately. */
  begin(key: string): void {
    this.key = key;
    this.step = 0;
  }

  /** Live playback tick from the companion. */
  report(step: number): void {
    this.step = step;
  }

  /** Companion closed — clear the ring. */
  clear(): void {
    this.key = null;
    this.step = 0;
  }
}

export function setGuideActiveStep(state: GuideActiveStep): void {
  setContext(GUIDE_ACTIVE_STEP_KEY, state);
}

export function getGuideActiveStep(): GuideActiveStep | null {
  return getContext<GuideActiveStep | null>(GUIDE_ACTIVE_STEP_KEY) ?? null;
}
