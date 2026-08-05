export const DEFAULT_MIN_QUIET_DAYS = 14;
export const DEFAULT_MIN_ELIGIBLE_SESSIONS = 100;

export type ProductionVerificationStatus =
  | "waiting-for-deploy"
  | "canary-failed"
  | "observing"
  | "recurred"
  | "passed";

export interface ProductionVerificationSnapshot {
  status: ProductionVerificationStatus;
  targetSourceSha256: string;
  deployedSourceSha256: string | null;
  rulesetName: string | null;
  releaseUpdatedAt: string | null;
  startedAt: string | null;
  lastCheckedAt: string;
  canaryPassedAt: string | null;
  eligibleSessions: number;
  eligibleIdentities: number;
  matchingSessions: number;
  matchingIdentities: number;
  minQuietDays: number;
  minEligibleSessions: number;
  reason: string;
}

export interface ProductionVerificationObservation {
  now: Date;
  deployedSourceMatches: boolean;
  canaryPassed: boolean;
  startedAt: string | null;
  eligibleSessions: number;
  matchingSessions: number;
  minQuietDays?: number;
  minEligibleSessions?: number;
}

export interface ProductionVerificationDecision {
  status: ProductionVerificationStatus;
  reason: string;
  quietDays: number;
  sessionsRemaining: number;
}

/**
 * Evaluate deploy proof, a live authorization canary, and production exposure.
 * Recurrence wins immediately. Silence only passes after both time and traffic
 * thresholds are satisfied.
 */
export function evaluateProductionVerification(
  observation: ProductionVerificationObservation
): ProductionVerificationDecision {
  const minQuietDays = observation.minQuietDays ?? DEFAULT_MIN_QUIET_DAYS;
  const minEligibleSessions =
    observation.minEligibleSessions ?? DEFAULT_MIN_ELIGIBLE_SESSIONS;
  const sessionsRemaining = Math.max(
    0,
    minEligibleSessions - observation.eligibleSessions
  );

  if (!observation.deployedSourceMatches) {
    return {
      status: "waiting-for-deploy",
      reason:
        "The deployed reviewed-rule fingerprint does not match this checkout.",
      quietDays: 0,
      sessionsRemaining,
    };
  }

  if (!observation.canaryPassed) {
    return {
      status: "canary-failed",
      reason: "The deployed anonymous-owner profile read was denied.",
      quietDays: 0,
      sessionsRemaining,
    };
  }

  if (!observation.startedAt) {
    return {
      status: "canary-failed",
      reason: "The deployed release has no observation start time.",
      quietDays: 0,
      sessionsRemaining,
    };
  }

  const elapsedMs = Math.max(
    0,
    observation.now.getTime() - new Date(observation.startedAt).getTime()
  );
  const quietDays = elapsedMs / (24 * 60 * 60 * 1000);

  if (observation.matchingSessions > 0) {
    return {
      status: "recurred",
      reason: `${observation.matchingSessions} exposed session(s) hit the same permission denial.`,
      quietDays,
      sessionsRemaining,
    };
  }

  if (quietDays < minQuietDays || sessionsRemaining > 0) {
    const gates: string[] = [];
    if (quietDays < minQuietDays) {
      gates.push(`${Math.ceil(minQuietDays - quietDays)} quiet day(s)`);
    }
    if (sessionsRemaining > 0) {
      gates.push(`${sessionsRemaining} exposed session(s)`);
    }
    return {
      status: "observing",
      reason: `Waiting for ${gates.join(" and ")}.`,
      quietDays,
      sessionsRemaining,
    };
  }

  return {
    status: "passed",
    reason: `${observation.eligibleSessions} exposed sessions completed the profile read with no matching denial over ${Math.floor(quietDays)} days.`,
    quietDays,
    sessionsRemaining: 0,
  };
}
