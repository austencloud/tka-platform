/**
 * ShareHubUrlManager
 *
 * Manages URL state synchronization for the Share Hub panel.
 * Handles deep linking, history management, and state restoration for animation exports.
 *
 * Domain: Share Hub - URL State Management
 */

import { replaceState } from "$app/navigation";
import type { ISheetRouter } from "$lib/shared/navigation/services/contracts/ISheetRouter";
import type {
  IShareHubUrlManager,
  ShareHubUrlCallbacks,
  ShareHubAnimationUrlState,
} from "../contracts/IShareHubUrlManager";
import { browser } from "$app/environment";

export class ShareHubUrlManager implements IShareHubUrlManager {
  private cleanupRouteListener: (() => void) | undefined;
  private callbacks: ShareHubUrlCallbacks | null = null;

  constructor(private readonly sheetRouter: ISheetRouter | null) {}

  initialize(callbacks: ShareHubUrlCallbacks): () => void {
    if (!this.sheetRouter) {
      console.warn("ShareHubUrlManager: No sheet router available");
      return () => {};
    }

    this.callbacks = callbacks;

    // Listen for route changes (back button, programmatic navigation)
    this.cleanupRouteListener = this.sheetRouter.onRouteChange((state) => {
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
    const initialState = this.sheetRouter.getCurrentAnimationPanelState();
    if (initialState) {
      this.callbacks?.onAnimationPanelOpen();
      this.callbacks?.onStateRestore(initialState);
    }

    return () => this.dispose();
  }

  pushAnimationPanelOpen(state: ShareHubAnimationUrlState): void {
    if (!this.sheetRouter) return;

    this.sheetRouter.openAnimationPanel({
      sequenceId: state.sequenceId,
      speed: state.speed,
      isPlaying: state.isPlaying,
      currentStep: state.currentStep,
      gridVisible: true,
    });
  }

  updateAnimationState(state: Partial<ShareHubAnimationUrlState>): void {
    if (!this.sheetRouter) return;

    // Only update if animation panel is currently open in URL
    const currentState = this.sheetRouter.getCurrentAnimationPanelState();
    if (currentState === null) return;

    this.sheetRouter.updateAnimationPanelState({
      speed: state.speed,
      isPlaying: state.isPlaying,
      currentStep: state.currentStep,
    });
  }

  clearUrlState(): void {
    if (!browser) return;

    // Clear all Share Hub-related URL parameters
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
    if (!this.sheetRouter) return false;
    return this.sheetRouter.getCurrentAnimationPanelState() !== null;
  }

  getCurrentUrlState(): ShareHubAnimationUrlState | null {
    if (!this.sheetRouter) return null;

    const state = this.sheetRouter.getCurrentAnimationPanelState();
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
