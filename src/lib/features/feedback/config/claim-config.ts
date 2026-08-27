/**
 * Claim Configuration
 *
 * Single source of truth for all claim-related thresholds and settings.
 * Shared between frontend (ClaimStatusDeriver) and backend (CLI, Cloud Functions).
 *
 * All durations are in milliseconds.
 */


/**
 * Stale thresholds for claim management.
 *
 * A claim is considered "stale" (abandonable by another agent) when EITHER:
 * 1. No activity for ACTIVITY_TIMEOUT_MS (45 min default), OR
 * 2. Total claim time exceeds TOTAL_CLAIM_MAX_MS (8 hours default)
 *
 * The activity-based check catches crashed/abandoned sessions.
 * The hard cap prevents indefinite claim hoarding.
 */
export const STALE_THRESHOLDS = {
  /**
   * No activity for this long = stale (agent likely crashed or forgot)
   * @default 45 minutes
   */
  ACTIVITY_TIMEOUT_MS: 45 * 60 * 1000,

  /**
   * Hard cap on total claim time, even with activity
   * @default 8 hours
   */
  TOTAL_CLAIM_MAX_MS: 8 * 60 * 60 * 1000,

  /**
   * Show warning when approaching staleness (for heartbeat reminders)
   * @default 30 minutes
   */
  WARNING_THRESHOLD_MS: 30 * 60 * 1000,

  /**
   * How long a claim request waits before auto-approving
   * @default 15 minutes
   */
  REQUEST_WAIT_MS: 15 * 60 * 1000,
} as const;

/**
 * Legacy alias for backward compatibility.
 * @deprecated Use STALE_THRESHOLDS.ACTIVITY_TIMEOUT_MS directly
 */
export const STALE_CLAIM_MS = STALE_THRESHOLDS.ACTIVITY_TIMEOUT_MS;


/**
 * Agent session configuration for the identity system.
 */
export const AGENT_SESSION_CONFIG = {
  /**
   * How long an agent session can be inactive before cleanup
   * @default 1 hour
   */
  SESSION_TIMEOUT_MS: 60 * 60 * 1000,

  /**
   * Valid agent types that can register sessions
   */
  VALID_AGENT_TYPES: ['claude-cli', 'human', 'ci'] as const,
} as const;

export type AgentType = (typeof AGENT_SESSION_CONFIG.VALID_AGENT_TYPES)[number];


/**
 * Emergency override configuration for claim takeovers.
 */
export const EMERGENCY_CONFIG = {
  /**
   * Cooldown between emergency actions (prevents abuse)
   * @default 1 hour
   */
  COOLDOWN_MS: 60 * 60 * 1000,

  /**
   * Whether to require double confirmation for emergency actions
   */
  REQUIRE_CONFIRMATION: true,
} as const;


/**
 * Work-in-progress limits per status.
 * Soft limits that show warnings when exceeded but allow override with --force.
 */
export const WIP_LIMITS = {
  /** No limit - inbound queue */
  new: 0,
  /** Key bottleneck (global across all agents) */
  'in-progress': 4,
  /** Buffer for testing */
  'in-review': 5,
  /** No limit - staging area */
  completed: 0,
} as const;


/**
 * Possible states of a claim's health
 */
export type ClaimHealth =
  | 'none'     // No claim exists
  | 'active'   // Claim is active and valid
  | 'stale'    // Claim has timed out (activity or total)
  | 'orphaned' // Status is in-progress but no claim token exists

/**
 * Stale reason codes for diagnostics
 */
export type StaleReason =
  | 'no-claim-time'     // claimedAt is missing
  | 'exceeded-max-time' // Total claim time > 8 hours
  | 'no-activity'       // No heartbeat for > 45 minutes


/**
 * Check if a claim is stale (abandonable by another agent)
 *
 * @param claimedAt - When the claim was created (Date or timestamp)
 * @param lastActivity - Most recent activity (Date or timestamp), falls back to claimedAt
 * @returns Staleness status with reason and age information
 */
export function checkClaimStaleness(
  claimedAt: Date | number | null | undefined,
  lastActivity?: Date | number | null
): {
  isStale: boolean;
  reason: StaleReason | null;
  ageMs: number;
  activityAgeMs: number;
} {
  const now = Date.now();

  // Normalize to milliseconds
  const claimedAtMs = normalizeTimestamp(claimedAt);
  const lastActivityMs = normalizeTimestamp(lastActivity) ?? claimedAtMs;

  if (claimedAtMs === null) {
    return {
      isStale: true,
      reason: 'no-claim-time',
      ageMs: Infinity,
      activityAgeMs: Infinity,
    };
  }

  const totalAgeMs = now - claimedAtMs;
  const activityAgeMs = lastActivityMs !== null ? now - lastActivityMs : totalAgeMs;

  // Check hard cap first (8 hours)
  if (totalAgeMs > STALE_THRESHOLDS.TOTAL_CLAIM_MAX_MS) {
    return {
      isStale: true,
      reason: 'exceeded-max-time',
      ageMs: totalAgeMs,
      activityAgeMs,
    };
  }

  // Check activity timeout (45 min)
  if (activityAgeMs > STALE_THRESHOLDS.ACTIVITY_TIMEOUT_MS) {
    return {
      isStale: true,
      reason: 'no-activity',
      ageMs: totalAgeMs,
      activityAgeMs,
    };
  }

  return {
    isStale: false,
    reason: null,
    ageMs: totalAgeMs,
    activityAgeMs,
  };
}

/**
 * Check if a claim is approaching staleness (for warnings)
 *
 * @param lastActivity - Most recent activity timestamp
 * @returns true if activity age exceeds WARNING_THRESHOLD_MS
 */
export function isApproachingStale(
  lastActivity: Date | number | null | undefined
): boolean {
  const lastActivityMs = normalizeTimestamp(lastActivity);
  if (lastActivityMs === null) return true;

  const activityAge = Date.now() - lastActivityMs;
  return activityAge > STALE_THRESHOLDS.WARNING_THRESHOLD_MS;
}

/**
 * Format milliseconds as human-readable duration
 *
 * @param ms - Duration in milliseconds
 * @returns Formatted string like "5m", "2h 30m", "8h"
 */
export function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
}

/**
 * Normalize various timestamp formats to milliseconds
 */
function normalizeTimestamp(
  value: Date | number | null | undefined
): number | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  return null;
}
