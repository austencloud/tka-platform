/**
 * Attribution Prompt Types
 *
 * Types for the deferred attribution prompt that appears after
 * users have had time to explore the app.
 */

/**
 * State persisted to localStorage for the attribution prompt
 */
export interface AttributionPromptState {
  /** Whether the user has completed the attribution question */
  completed: boolean;

  /** Number of times the prompt has been shown */
  showCount: number;

  /** Timestamp when first eligible to show (signup + delay) */
  eligibleAfter: string;

  /** Timestamp when last dismissed (if dismissed) */
  lastDismissed?: string;

  /** Timestamp when completed (if completed) */
  completedAt?: string;
}

/**
 * Engagement metrics used to determine prompt eligibility
 */
export interface EngagementMetrics {
  /** Number of sequences viewed */
  sequencesViewed: number;

  /** Number of sequences created/saved */
  sequencesCreated: number;

  /** Number of distinct modules visited */
  modulesVisited: number;

  /** Total session count */
  sessionCount: number;

  /** Days since first seen */
  daysSinceSignup: number;
}

/**
 * Configuration for when to show the attribution prompt
 */
export interface AttributionPromptConfig {
  /** Minimum days after signup before showing */
  minDaysAfterSignup: number;

  /** Minimum total interactions (views + creates) */
  minInteractions: number;

  /** Minimum modules visited */
  minModulesVisited: number;

  /** Hours to wait after dismissal before showing again */
  dismissalCooldownHours: number;

  /** Maximum times to show before giving up */
  maxShowCount: number;
}

/**
 * Default configuration - balanced for engagement without being annoying
 */
export const DEFAULT_PROMPT_CONFIG: AttributionPromptConfig = {
  minDaysAfterSignup: 1, // At least 1 day of use
  minInteractions: 5, // 5 sequences viewed/created
  minModulesVisited: 2, // Explored at least 2 modules
  dismissalCooldownHours: 48, // Wait 2 days after dismissal
  maxShowCount: 3, // Give up after 3 attempts
};

/**
 * localStorage key for prompt state
 */
export const PROMPT_STATE_KEY = "tka-attribution-prompt-state";
