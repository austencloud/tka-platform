/**
 * Sheet Router Service Contract
 *
 * Manages route-based navigation for sheets, spotlight views, and animation panels.
 * Handles browser history and URL state for a native app-like experience.
 *
 * Domain: Navigation - Route Management
 */

/**
 * Available sheet types that can be opened via routes
 */
export type SheetType =
  | "settings"
  | "auth"
  | "terms"
  | "privacy"
  | "animation"
  | null;

/**
 * Animation panel state for URL persistence
 */
export interface AnimationPanelState {
  sequenceId?: string;
  speed?: number;
  isPlaying?: boolean;
  currentStep?: number;
  gridVisible?: boolean;
}

/**
 * Route state containing all active navigable content
 */
export interface RouteState {
  sheet?: SheetType;
  spotlight?: string;
  animationPanel?: AnimationPanelState;
}

/**
 * Service for managing route-based navigation
 */
export interface ISheetRouter {
  // ============================================================================
  // Sheet Management
  // ============================================================================

  /**
   * Open a sheet by pushing a new history entry
   * Allows the back button to close the sheet naturally
   */
  openSheet(sheetType: SheetType): void;

  /**
   * Close the current sheet
   * Uses history replacement to maintain clean navigation
   */
  closeSheet(): void;

  /**
   * Get the currently open sheet from URL
   */
  getCurrentSheet(): SheetType;

  // ============================================================================
  // Spotlight Management
  // ============================================================================

  /**
   * Open a spotlight view with a sequence ID
   * Enables sharing and bookmarking specific sequences
   */
  openSpotlight(sequenceId: string): void;

  /**
   * Close the spotlight view
   */
  closeSpotlight(): void;

  /**
   * Get the currently open spotlight sequence ID
   */
  getCurrentSpotlight(): string | null;

  /**
   * Get the shareable URL for a spotlight sequence
   */
  getSpotlightShareURL(sequenceId: string): string;

  // ============================================================================
  // Animation Panel Management
  // ============================================================================

  /**
   * Open the animation panel with optional initial state
   */
  openAnimationPanel(animationState?: AnimationPanelState): void;

  /**
   * Update animation panel state without creating new history entry
   * Useful for playback state changes
   */
  updateAnimationPanelState(animationState: Partial<AnimationPanelState>): void;

  /**
   * Get the current animation panel state
   */
  getCurrentAnimationPanelState(): AnimationPanelState | null;

  // ============================================================================
  // General Route Management
  // ============================================================================

  /**
   * Get current route state (all active routes)
   */
  getCurrentRouteState(): RouteState;

  /**
   * Close all route-based views (sheets, spotlight, etc.)
   */
  closeAll(): void;

  /**
   * Subscribe to route changes
   * @returns Cleanup function to unsubscribe
   */
  onRouteChange(callback: (state: RouteState) => void): () => void;
}
