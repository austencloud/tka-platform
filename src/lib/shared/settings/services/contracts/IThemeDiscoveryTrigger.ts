/**
 * IThemeDiscoveryTrigger
 *
 * Determines when to show the theme discovery nudge
 * based on session count and background tab visit history.
 */
export interface IThemeDiscoveryTrigger {
  /** Check if the nudge should be shown this session */
  shouldShowNudge(): boolean;

  /** Record that the user visited the Background tab in Settings */
  recordBackgroundTabVisit(): void;

  /** Record that the nudge was dismissed (by X, "Show me", or auto-timeout) */
  recordNudgeDismissed(): void;

  /** Increment session count (called on app init) */
  recordSessionStart(): void;
}
