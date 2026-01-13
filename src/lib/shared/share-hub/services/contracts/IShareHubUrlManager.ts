/**
 * IShareHubUrlManager
 *
 * Contract for managing URL state synchronization for the Share Hub panel.
 * Handles deep linking, history management, and state restoration for animation exports.
 *
 * Domain: Share Hub - URL State Management
 */

import type { AnimationPanelState as URLAnimationState } from "$lib/shared/navigation/services/contracts/ISheetRouter";

/**
 * Animation state that can be persisted to/restored from URL
 */
export interface ShareHubAnimationUrlState {
  sequenceId?: string;
  speed?: number;
  isPlaying?: boolean;
  currentBeat?: number;
}

/**
 * Callbacks for URL-driven state changes
 */
export interface ShareHubUrlCallbacks {
  /** Called when URL indicates animation panel should open */
  onAnimationPanelOpen: () => void;
  /** Called with restored state from URL (on initial load or back navigation) */
  onStateRestore: (state: URLAnimationState) => void;
}

export interface IShareHubUrlManager {
  /**
   * Initialize URL listening and check for initial state.
   * @param callbacks Handlers for URL-driven state changes
   * @returns Cleanup function to stop listening
   */
  initialize(callbacks: ShareHubUrlCallbacks): () => void;

  /**
   * Push animation panel open state to URL.
   * Creates new history entry for back button support.
   */
  pushAnimationPanelOpen(state: ShareHubAnimationUrlState): void;

  /**
   * Update animation state in URL without creating new history entry.
   * Used for playback changes (speed, playing state).
   */
  updateAnimationState(state: Partial<ShareHubAnimationUrlState>): void;

  /**
   * Clear all Share Hub URL parameters.
   * Called when panel closes.
   */
  clearUrlState(): void;

  /**
   * Check if animation panel should be open based on current URL.
   */
  shouldAnimationPanelBeOpen(): boolean;

  /**
   * Get current animation state from URL if present.
   */
  getCurrentUrlState(): ShareHubAnimationUrlState | null;
}
