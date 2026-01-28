/**
 * Type definitions for the feedback claims system
 */

/**
 * Valid agent types that can register sessions
 */
export type AgentType = 'claude-cli' | 'human' | 'ci';

/**
 * Agent session stored in Firestore
 */
export interface AgentSession {
  sessionId: string;
  agentType: AgentType;
  agentName?: string;
  registeredAt: FirebaseFirestore.Timestamp;
  lastActivity: FirebaseFirestore.Timestamp;
  activeClaims: string[]; // Array of feedback document IDs
  metadata?: {
    version?: string;
    hostname?: string;
  };
}

/**
 * Active file edit tracking
 */
export interface ActiveFileEdit {
  filePath: string;
  feedbackId: string;
  sessionId: string;
  startedAt: FirebaseFirestore.Timestamp;
}

/**
 * Emergency action record for audit
 */
export interface EmergencyAction {
  actionType: 'unclaim' | 'takeover';
  feedbackId: string;
  performedBy: string;
  reason: string;
  timestamp: FirebaseFirestore.Timestamp;
  previousClaimant?: string;
  previousClaimToken?: string;
}

/**
 * Stale threshold constants (must match claim-config.ts)
 */
export const STALE_THRESHOLDS = {
  ACTIVITY_TIMEOUT_MS: 45 * 60 * 1000, // 45 minutes
  TOTAL_CLAIM_MAX_MS: 8 * 60 * 60 * 1000, // 8 hours
  WARNING_THRESHOLD_MS: 30 * 60 * 1000, // 30 minutes
  REQUEST_WAIT_MS: 15 * 60 * 1000, // 15 minutes
} as const;

export const AGENT_SESSION_CONFIG = {
  SESSION_TIMEOUT_MS: 60 * 60 * 1000, // 1 hour
  VALID_AGENT_TYPES: ['claude-cli', 'human', 'ci'] as const,
} as const;

export const EMERGENCY_CONFIG = {
  COOLDOWN_MS: 60 * 60 * 1000, // 1 hour
  REQUIRE_CONFIRMATION: true,
} as const;

/**
 * Check if a claim is stale
 */
export function checkClaimStaleness(
  claimedAt: FirebaseFirestore.Timestamp | null | undefined,
  lastActivity?: FirebaseFirestore.Timestamp | null
): {
  isStale: boolean;
  reason: 'no-claim-time' | 'exceeded-max-time' | 'no-activity' | null;
  ageMs: number;
  activityAgeMs: number;
} {
  const now = Date.now();

  const claimedAtMs = claimedAt?.toMillis() ?? null;
  const lastActivityMs = lastActivity?.toMillis() ?? claimedAtMs;

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

  if (totalAgeMs > STALE_THRESHOLDS.TOTAL_CLAIM_MAX_MS) {
    return {
      isStale: true,
      reason: 'exceeded-max-time',
      ageMs: totalAgeMs,
      activityAgeMs,
    };
  }

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
