/**
 * IAttributionPromptTrigger
 *
 * Service contract for determining when to show the
 * deferred attribution question prompt.
 */

import type {
  AttributionPromptState,
  EngagementMetrics,
} from "../../domain/prompt-types";

export interface IAttributionPromptTrigger {
  /**
   * Check if the attribution prompt should be shown now.
   * Considers time since signup, engagement level, and previous dismissals.
   */
  shouldShowPrompt(): boolean;

  /**
   * Get current engagement metrics for the user.
   */
  getEngagementMetrics(): EngagementMetrics;

  /**
   * Get current prompt state from storage.
   */
  getPromptState(): AttributionPromptState;

  /**
   * Initialize prompt tracking for a new user.
   * Called after signup to set the eligibility timer.
   */
  initializeForNewUser(): void;

  /**
   * Record that the prompt was shown.
   */
  recordPromptShown(): void;

  /**
   * Record that the user dismissed the prompt without answering.
   */
  recordPromptDismissed(): void;

  /**
   * Record that the user completed the attribution question.
   */
  recordPromptCompleted(): void;

  /**
   * Increment engagement counters.
   * Called by activity logging system.
   */
  recordInteraction(type: "sequence_view" | "sequence_create" | "module_visit"): void;

  /**
   * Record a module visit for engagement tracking.
   */
  recordModuleVisit(moduleId: string): void;

  /**
   * Increment session count (called on app init).
   */
  recordSessionStart(): void;
}
