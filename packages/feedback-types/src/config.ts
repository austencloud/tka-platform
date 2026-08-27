/**
 * Feedback system configuration constants.
 *
 * Single source of truth for claim thresholds, WIP limits, and agent session config.
 */

import type { ClaimHealth, StaleReason } from "./enums.js";


export const STALE_THRESHOLDS = {
  /** No activity for this long = stale (agent likely crashed or forgot) */
  ACTIVITY_TIMEOUT_MS: 45 * 60 * 1000,
  /** Hard cap on total claim time, even with activity */
  TOTAL_CLAIM_MAX_MS: 8 * 60 * 60 * 1000,
  /** Show warning when approaching staleness */
  WARNING_THRESHOLD_MS: 30 * 60 * 1000,
  /** How long a claim request waits before auto-approving */
  REQUEST_WAIT_MS: 15 * 60 * 1000,
} as const;

/**
 * Legacy alias for backward compatibility.
 * @deprecated Use STALE_THRESHOLDS.ACTIVITY_TIMEOUT_MS directly
 */
export const STALE_CLAIM_MS = STALE_THRESHOLDS.ACTIVITY_TIMEOUT_MS;

export const AGENT_SESSION_CONFIG = {
  /** How long an agent session can be inactive before cleanup */
  SESSION_TIMEOUT_MS: 60 * 60 * 1000,
  /** Valid agent types that can register sessions */
  VALID_AGENT_TYPES: ["claude-cli", "human", "ci"] as const,
} as const;

export type AgentType =
  (typeof AGENT_SESSION_CONFIG.VALID_AGENT_TYPES)[number];

export const EMERGENCY_CONFIG = {
  /** Cooldown between emergency actions (prevents abuse) */
  COOLDOWN_MS: 60 * 60 * 1000,
  /** Whether to require double confirmation for emergency actions */
  REQUIRE_CONFIRMATION: true,
} as const;


export const WIP_LIMITS = {
  new: 0,
  "in-progress": 4,
  "in-review": 5,
  completed: 0,
} as const;


function normalizeTimestamp(
  value: Date | number | null | undefined
): number | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  return null;
}

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

  const claimedAtMs = normalizeTimestamp(claimedAt);
  const lastActivityMs = normalizeTimestamp(lastActivity) ?? claimedAtMs;

  if (claimedAtMs === null) {
    return {
      isStale: true,
      reason: "no-claim-time",
      ageMs: Infinity,
      activityAgeMs: Infinity,
    };
  }

  const totalAgeMs = now - claimedAtMs;
  const activityAgeMs =
    lastActivityMs !== null ? now - lastActivityMs : totalAgeMs;

  if (totalAgeMs > STALE_THRESHOLDS.TOTAL_CLAIM_MAX_MS) {
    return {
      isStale: true,
      reason: "exceeded-max-time",
      ageMs: totalAgeMs,
      activityAgeMs,
    };
  }

  if (activityAgeMs > STALE_THRESHOLDS.ACTIVITY_TIMEOUT_MS) {
    return {
      isStale: true,
      reason: "no-activity",
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

export function isApproachingStale(
  lastActivity: Date | number | null | undefined
): boolean {
  const lastActivityMs = normalizeTimestamp(lastActivity);
  if (lastActivityMs === null) return true;

  const activityAge = Date.now() - lastActivityMs;
  return activityAge > STALE_THRESHOLDS.WARNING_THRESHOLD_MS;
}

export function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
}
