/**
 * Theme Discovery State
 *
 * Reactive Svelte 5 state for the theme discovery nudge.
 * Controls visibility and coordinates with ThemeDiscoveryTrigger.
 */

import { browser } from "$app/environment";

const SHOW_DELAY_MS = 8000;
const AUTO_DISMISS_MS = 15000;

class ThemeDiscoveryStateManager {
  /** Whether the nudge is currently visible */
  isVisible = $state(false);

  /** Whether we've already checked eligibility this session */
  private checkedThisSession = false;

  /** Timer for auto-dismiss */
  private autoDismissTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Check if the nudge should be shown and schedule it if conditions are met.
   * Called from MainApplication after the app stabilizes.
   */
  async checkAndMaybeShow(): Promise<void> {
    if (!browser || this.checkedThisSession || this.isVisible) {
      return;
    }

    this.checkedThisSession = true;

    try {
      const { container } = await import("$lib/shared/di");
      const trigger = container?.items?.themeDiscoveryTrigger;

      if (trigger && typeof trigger.shouldShowNudge === "function") {
        if (trigger.shouldShowNudge()) {
          setTimeout(() => {
            this.show();
          }, SHOW_DELAY_MS);
        }
      }
    } catch (error) {
      console.warn("[ThemeDiscoveryState] Check failed:", error);
    }
  }

  show(): void {
    this.isVisible = true;

    // Auto-dismiss after 15 seconds
    this.autoDismissTimer = setTimeout(() => {
      this.dismiss();
    }, AUTO_DISMISS_MS);
  }

  dismiss(): void {
    this.isVisible = false;

    if (this.autoDismissTimer) {
      clearTimeout(this.autoDismissTimer);
      this.autoDismissTimer = null;
    }

    // Record dismissal so it never shows again
    import("$lib/shared/di")
      .then(({ container }) => {
        const trigger = container?.items?.themeDiscoveryTrigger;
        if (trigger && typeof trigger.recordNudgeDismissed === "function") {
          trigger.recordNudgeDismissed();
        }
      })
      .catch(() => {
        // Non-critical
      });
  }
}

/** Singleton instance */
export const themeDiscoveryState = new ThemeDiscoveryStateManager();
