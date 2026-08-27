/**
 * Gesture Service Contract
 *
 * Provides reusable touch gesture handling for common interaction patterns.
 */

export type GestureDirection = "vertical" | "horizontal";
export type GestureOrientation = "down" | "up" | "left" | "right";

export interface SwipeGestureConfig {
  /**
   * The direction of the swipe gesture
   */
  direction: GestureDirection;

  /**
   * Which orientation(s) should trigger the dismiss action
   * For vertical: 'down' or 'up'
   * For horizontal: 'right' or 'left'
   */
  dismissOrientation: GestureOrientation;

  /**
   * Minimum distance in pixels to trigger dismiss
   * @default 100
   */
  threshold?: number;

  /**
   * Callback when gesture meets dismiss threshold
   */
  onDismiss: () => void;

  /**
   * Optional callback for visual feedback during drag
   * @param delta - The current drag distance
   */
  onDrag?: (delta: number) => void;

  /**
   * Optional callback when gesture is released but doesn't meet threshold (snap back)
   */
  onSnapBack?: () => void;
}

export interface SwipeGestureHandler {
  handleTouchStart: (e: TouchEvent) => void;
  handleTouchMove: (e: TouchEvent) => void;
  handleTouchEnd: () => void;
}

/**
 * Platform Detection Service Contract
 *
 * Provides centralized platform and browser detection capabilities.
 * Eliminates duplication of detection logic across components.
 */

export type Platform = "ios" | "android" | "desktop";
export type Browser =
  | "chrome"
  | "safari"
  | "edge"
  | "firefox"
  | "samsung"
  | "other";

/**
 * In-app browsers that don't support PWA installation
 * Users must be redirected to a real browser
 */
export type InAppBrowser =
  | "instagram"
  | "facebook"
  | "twitter"
  | "tiktok"
  | "snapchat"
  | "linkedin"
  | "pinterest"
  | "messenger"
  | "threads"
  | "none";

export interface PlatformInfo {
  platform: Platform;
  browser: Browser;
  inAppBrowser: InAppBrowser;
  isStandalone: boolean; // Already installed as PWA
}

/**
 * PWA Engagement Tracking Service Contract
 *
 * Tracks user engagement signals to determine optimal timing
 * for showing PWA install prompts.
 */

export interface PWAEngagementMetrics {
  /** Number of times user has visited the app */
  visitCount: number;

  /** Whether user has created at least one sequence */
  hasCreatedSequence: boolean;

  /** Number of meaningful interactions (clicks, selections, etc.) */
  interactionCount: number;

  /** Total time spent in app (milliseconds) */
  totalTimeSpent: number;

  /** Timestamp of first visit */
  firstVisit: number;

  /** Timestamp of last visit */
  lastVisit: number;
}

export interface PWADismissalState {
  dismissCount: number;
  lastDismissed: number | null;
  neverAskAgain: boolean;
  hasInstalled: boolean;
}

