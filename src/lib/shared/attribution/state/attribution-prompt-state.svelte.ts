/**
 * Attribution Prompt State
 *
 * Reactive Svelte 5 state for the deferred attribution prompt.
 * Controls visibility and tracks when to show the prompt.
 */

import { browser } from "$app/environment";

import { getAttributionPromptTrigger } from "$lib/shared/attribution/getAttributionPromptTrigger";

/**
 * Reactive state for the attribution prompt
 */
class AttributionPromptStateManager {
  /** Whether the prompt is currently visible */
  isVisible = $state(false);

  /** Whether we've already checked eligibility this session */
  private checkedThisSession = false;

  /**
   * Show the attribution prompt
   */
  show(): void {
    this.isVisible = true;
  }

  /**
   * Hide the attribution prompt
   */
  hide(): void {
    this.isVisible = false;
  }

  /**
   * Check if the prompt should be shown and show it if conditions are met.
   * This is called from MainApplication after the app stabilizes.
   */
  async checkAndMaybeShow(): Promise<void> {
    if (!browser || this.checkedThisSession || this.isVisible) {
      return;
    }

    this.checkedThisSession = true;

    try {
      const trigger = getAttributionPromptTrigger();

      if (trigger && typeof trigger.shouldShowPrompt === "function") {
        if (trigger.shouldShowPrompt()) {
          // Small delay so the app feels settled before showing
          setTimeout(() => {
            this.show();
            trigger.recordPromptShown();
          }, 2000);
        }
      }
    } catch (error) {
      console.warn("[AttributionPromptState] Check failed:", error);
    }
  }

  /**
   * Reset the session check (for testing)
   */
  resetSessionCheck(): void {
    this.checkedThisSession = false;
  }
}

/**
 * Singleton instance of the attribution prompt state
 */
export const attributionPromptState = new AttributionPromptStateManager();

/**
 * Get the prompt state manager
 */
export function getAttributionPromptState(): AttributionPromptStateManager {
  return attributionPromptState;
}
