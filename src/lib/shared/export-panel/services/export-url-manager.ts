/**
 * ExportUrlManager
 *
 * Manages URL state synchronization for the export panel.
 * Handles deep linking, history management, and state restoration for animation exports.
 *
 * Domain: Export Panel - URL State Management
 */

import { replaceState } from "$app/navigation";
import {
  onRouteChange,
  getCurrentAnimationPanelState,
  openAnimationPanel,
  updateAnimationPanelState,
} from "$lib/shared/navigation/services/sheet-router";
import type { ExportUrlCallbacks, ExportAnimationUrlState } from "./types";
import { browser } from "$app/environment";

export class ExportUrlManager {
  private cleanupRouteListener: (() => void) | undefined;
  private callbacks: ExportUrlCallbacks | null = null;

  initialize(callbacks: ExportUrlCallbacks): () => void {
    this.callbacks = callbacks;

    // Listen for route changes (back button, programmatic navigation)
    this.cleanupRouteListener = onRouteChange((state) => {
      if (state.sheet === "animation") {
        // Notify that animation panel should open
        this.callbacks?.onAnimationPanelOpen();

        // Restore state from URL if available
        if (state.animationPanel) {
          this.callbacks?.onStateRestore(state.animationPanel);
        }
      }
    });

    // Check initial URL state
    const initialState = getCurrentAnimationPanelState();
    if (initialState) {
      this.callbacks?.onAnimationPanelOpen();
      this.callbacks?.onStateRestore(initialState);
    }

    return () => this.dispose();
  }

  pushAnimationPanelOpen(state: ExportAnimationUrlState): void {
    openAnimationPanel({
      sequenceId: state.sequenceId,
      speed: state.speed,
      isPlaying: state.isPlaying,
      currentStep: state.currentStep,
      gridVisible: true,
    });
  }

  updateAnimationState(state: Partial<ExportAnimationUrlState>): void {
    // Only update if animation panel is currently open in URL
    const currentState = getCurrentAnimationPanelState();
    if (currentState === null) return;

    updateAnimationPanelState({
      speed: state.speed,
      isPlaying: state.isPlaying,
      currentStep: state.currentStep,
    });
  }

  clearUrlState(): void {
    if (!browser) return;

    // Clear all export panel URL parameters
    const url = new URL(window.location.href);
    url.searchParams.delete("sheet");
    url.searchParams.delete("animSeqId");
    url.searchParams.delete("animSpeed");
    url.searchParams.delete("animPlaying");
    url.searchParams.delete("animStep");
    url.searchParams.delete("animGrid");

    replaceState(url, {});
    window.dispatchEvent(new CustomEvent("route-change", { detail: {} }));
  }

  shouldAnimationPanelBeOpen(): boolean {
    return getCurrentAnimationPanelState() !== null;
  }

  getCurrentUrlState(): ExportAnimationUrlState | null {
    const state = getCurrentAnimationPanelState();
    if (!state) return null;

    return {
      sequenceId: state.sequenceId,
      speed: state.speed,
      isPlaying: state.isPlaying,
      currentStep: state.currentStep,
    };
  }

  private dispose(): void {
    this.cleanupRouteListener?.();
    this.cleanupRouteListener = undefined;
    this.callbacks = null;
  }
}
