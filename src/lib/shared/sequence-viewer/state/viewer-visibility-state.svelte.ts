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
  leftMotion = $state(true);
  rightMotion = $state(true);

  /**
   * @param allowNone When true, both motions may be hidden at once (the landing
   * spinner wants prop existence as a fully independent variable). Default
   * false preserves the viewer's invariant that at least one motion stays
   * visible — toggling off the last visible one flips the other back on.
   */
  constructor(private readonly allowNone = false) {}

  setLeftMotion(visible: boolean): void {
    if (!visible && !this.rightMotion && !this.allowNone) {
      this.leftMotion = false;
      this.rightMotion = true;
      return;
    }
    this.leftMotion = visible;
  }

  setRightMotion(visible: boolean): void {
    if (!visible && !this.leftMotion && !this.allowNone) {
      this.rightMotion = false;
      this.leftMotion = true;
      return;
    }
    this.rightMotion = visible;
  }

  toggleLeft(): void {
    this.setLeftMotion(!this.leftMotion);
  }

  toggleRight(): void {
    this.setRightMotion(!this.rightMotion);
  }

  reset(): void {
    this.leftMotion = true;
    this.rightMotion = true;
  }

  /** True when exactly one motion is visible. */
  get isSolo(): boolean {
    return this.leftMotion !== this.rightMotion;
  }

  /** The visible performer hand when isSolo, otherwise undefined. */
  get soloHand(): "left" | "right" | undefined {
    if (!this.isSolo) return undefined;
    return this.leftMotion ? "left" : "right";
  }
}
