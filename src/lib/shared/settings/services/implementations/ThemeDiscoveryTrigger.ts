/**
 * ThemeDiscoveryTrigger
 *
 * Determines when to show a nudge encouraging users to explore
 * background themes. Conditions:
 * - User has never visited the Background tab in Settings
 * - User has had 3+ sessions
 * - User has not dismissed the nudge before
 */

import { browser } from "$app/environment";
import type { IThemeDiscoveryTrigger } from "../contracts/IThemeDiscoveryTrigger";

const BACKGROUND_TAB_VISITED_KEY = "tka-background-tab-visited";
const NUDGE_DISMISSED_KEY = "tka-theme-discovery-dismissed";
const SESSION_COUNT_KEY = "tka-theme-discovery-sessions";

const MIN_SESSIONS = 3;

export class ThemeDiscoveryTrigger implements IThemeDiscoveryTrigger {
  shouldShowNudge(): boolean {
    if (!browser) return false;

    // Already dismissed or acted on
    if (localStorage.getItem(NUDGE_DISMISSED_KEY) === "true") {
      return false;
    }

    // User has already visited the Background tab — they know about themes
    if (localStorage.getItem(BACKGROUND_TAB_VISITED_KEY) === "true") {
      return false;
    }

    // Not enough sessions yet
    const sessionCount = this.getSessionCount();
    if (sessionCount < MIN_SESSIONS) {
      return false;
    }

    return true;
  }

  recordBackgroundTabVisit(): void {
    if (!browser) return;

    try {
      localStorage.setItem(BACKGROUND_TAB_VISITED_KEY, "true");
    } catch {
      // localStorage quota or permission issue — non-critical
    }
  }

  recordNudgeDismissed(): void {
    if (!browser) return;

    try {
      localStorage.setItem(NUDGE_DISMISSED_KEY, "true");
    } catch {
      // non-critical
    }
  }

  recordSessionStart(): void {
    if (!browser) return;

    try {
      const current = this.getSessionCount();
      localStorage.setItem(SESSION_COUNT_KEY, String(current + 1));
    } catch {
      // non-critical
    }
  }

  private getSessionCount(): number {
    try {
      const stored = localStorage.getItem(SESSION_COUNT_KEY);
      if (stored) {
        const parsed = parseInt(stored, 10);
        return isNaN(parsed) ? 0 : parsed;
      }
    } catch {
      // non-critical
    }
    return 0;
  }
}
