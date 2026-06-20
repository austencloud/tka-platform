/**
 * SequenceViewerVisibilityState
 *
 * Ephemeral per-viewer state for motion visibility. Not persisted to
 * localStorage. One instance per SequenceViewerOrchestrator mount,
 * provided to children via Svelte context.
 *
 * Reset semantics: caller invokes reset() when the sequence changes.
 * Constraint: at least one motion must remain visible - toggling off
 * the last visible motion automatically flips the other on.
 */
export class SequenceViewerVisibilityState {
  blueMotion = $state(true);
  redMotion = $state(true);

  /**
   * @param allowNone When true, both motions may be hidden at once (the landing
   * spinner wants prop existence as a fully independent variable). Default
   * false preserves the viewer's invariant that at least one motion stays
   * visible — toggling off the last visible one flips the other back on.
   */
  constructor(private readonly allowNone = false) {}

  setBlueMotion(visible: boolean): void {
    if (!visible && !this.redMotion && !this.allowNone) {
      this.blueMotion = false;
      this.redMotion = true;
      return;
    }
    this.blueMotion = visible;
  }

  setRedMotion(visible: boolean): void {
    if (!visible && !this.blueMotion && !this.allowNone) {
      this.redMotion = false;
      this.blueMotion = true;
      return;
    }
    this.redMotion = visible;
  }

  toggleBlue(): void {
    this.setBlueMotion(!this.blueMotion);
  }

  toggleRed(): void {
    this.setRedMotion(!this.redMotion);
  }

  reset(): void {
    this.blueMotion = true;
    this.redMotion = true;
  }

  /** True when exactly one motion is visible. */
  get isSolo(): boolean {
    return this.blueMotion !== this.redMotion;
  }

  /** The visible color when isSolo, otherwise undefined. */
  get soloColor(): "blue" | "red" | undefined {
    if (!this.isSolo) return undefined;
    return this.blueMotion ? "blue" : "red";
  }
}
