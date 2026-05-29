/**
 * OptionTransitionCoordinator - Orchestrates option selection transitions
 *
 * Extracted from OptionViewer.svelte to centralize transition choreography.
 */

import type { TransitionCallbacks, TransitionLifecycle } from "./types";

// Transition timing constants (same as original component)
const FADE_OUT_DURATION = 250;
const FADE_IN_DURATION = 250;

export class OptionTransitionCoordinator {
  private _isFadingOut = false;
  private _isTransitioning = false;
  private activeTimeouts: Array<ReturnType<typeof setTimeout>> = [];

  beginOptionSelection(callbacks: TransitionCallbacks): TransitionLifecycle {
    // Cancel any existing transitions
    this.cancelActiveTransition();

    // Start transition
    this._isFadingOut = true;
    this._isTransitioning = true;

    // Mid-fade-out callback (halfway through fade-out)
    const midFadeOutTimeout = setTimeout(() => {
      callbacks.onMidFadeOut?.();
    }, FADE_OUT_DURATION / 2);
    this.activeTimeouts.push(midFadeOutTimeout);

    // Fade-in start (after fade-out completes)
    const fadeInStartTimeout = setTimeout(() => {
      this._isFadingOut = false;
      callbacks.onFadeInStart?.();
    }, FADE_OUT_DURATION);
    this.activeTimeouts.push(fadeInStartTimeout);

    // Complete transition (after fade-in completes)
    const completeTimeout = setTimeout(() => {
      this._isTransitioning = false;
      this.activeTimeouts = []; // Clear completed timeouts
      callbacks.onComplete?.();
    }, FADE_OUT_DURATION + FADE_IN_DURATION);
    this.activeTimeouts.push(completeTimeout);

    return this.createLifecycleHandle();
  }

  beginUndoTransition(callbacks: TransitionCallbacks): TransitionLifecycle {
    // Cancel any existing transitions
    this.cancelActiveTransition();

    // Start transition
    this._isFadingOut = true;
    this._isTransitioning = true;

    // Mid-fade-out callback (halfway through fade-out)
    const midFadeOutTimeout = setTimeout(() => {
      callbacks.onMidFadeOut?.();
    }, FADE_OUT_DURATION / 2);
    this.activeTimeouts.push(midFadeOutTimeout);

    // Fade-in start (after fade-out completes)
    const fadeInStartTimeout = setTimeout(() => {
      this._isFadingOut = false;
      callbacks.onFadeInStart?.();
    }, FADE_OUT_DURATION);
    this.activeTimeouts.push(fadeInStartTimeout);

    // Complete transition (after fade-in completes)
    const completeTimeout = setTimeout(() => {
      this._isTransitioning = false;
      this.activeTimeouts = [];
      callbacks.onComplete?.();
    }, FADE_OUT_DURATION + FADE_IN_DURATION);
    this.activeTimeouts.push(completeTimeout);

    return this.createLifecycleHandle();
  }

  getState(): TransitionLifecycle {
    return this.createLifecycleHandle();
  }

  isTransitioning(): boolean {
    return this._isTransitioning;
  }

  dispose(): void {
    this.cancelActiveTransition();
  }

  private cancelActiveTransition(): void {
    // Clear all pending timeouts
    for (const timeout of this.activeTimeouts) {
      clearTimeout(timeout);
    }
    this.activeTimeouts = [];

    // Reset state
    this._isFadingOut = false;
    this._isTransitioning = false;
  }

  private createLifecycleHandle(): TransitionLifecycle {
    // Return object with bound methods to maintain correct 'this' context
    return {
      isFadingOut: this._isFadingOut,
      isTransitioning: this._isTransitioning,
      cancel: (): void => this.cancelActiveTransition(),
    };
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
export const optionTransitionCoordinator = new OptionTransitionCoordinator();
