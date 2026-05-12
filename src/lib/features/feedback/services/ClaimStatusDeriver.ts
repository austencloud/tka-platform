import type { FeedbackItem } from "$lib/shared/feedback/domain/models/feedback-models";
import type { EffectiveStatus, ClaimHealth } from "$lib/shared/feedback/domain/feedback-contract-types";
import {
  STALE_THRESHOLDS,
  checkClaimStaleness as sharedCheckClaimStaleness,
} from "../config/claim-config";

export class ClaimStatusDeriver {
  private readonly staleThresholdMs: number;

  constructor(staleThresholdMs: number = STALE_THRESHOLDS.ACTIVITY_TIMEOUT_MS) {
    this.staleThresholdMs = staleThresholdMs;
  }

  getStaleThresholdMs(): number {
    return this.staleThresholdMs;
  }

  hasActiveClaim(item: FeedbackItem): boolean {
    if (!item.claimToken || !item.claimedAt) {
      return false;
    }
    return !this.isClaimStale(item);
  }

  isClaimStale(item: FeedbackItem): boolean {
    if (!item.claimedAt) {
      return false; // No claim = not stale (different from stale)
    }

    // Use shared staleness check for consistency with CLI/backend
    const staleness = sharedCheckClaimStaleness(
      item.claimedAt,
      item.lastActivity ?? item.claimedAt
    );
    return staleness.isStale;
  }

  deriveEffectiveStatus(item: FeedbackItem): EffectiveStatus {
    const storedStatus = item.status;
    const hasClaim = Boolean(item.claimToken && item.claimedAt);
    const claimAgeMs = item.claimedAt
      ? Date.now() - item.claimedAt.getTime()
      : undefined;
    const claimTokenShort = item.claimToken?.substring(0, 8);

    // Determine claim health
    let claimHealth: ClaimHealth;
    if (!hasClaim) {
      // No claim
      if (storedStatus === "in-progress") {
        // Orphaned: status says in-progress but no claim exists
        claimHealth = "orphaned";
      } else {
        claimHealth = "none";
      }
    } else if (this.isClaimStale(item)) {
      claimHealth = "stale";
    } else {
      claimHealth = "active";
    }

    // Derive effective display status
    let displayStatus = storedStatus;

    if (claimHealth === "active") {
      // Active claim → always show as in-progress
      displayStatus = "in-progress";
    } else if (claimHealth === "stale") {
      // Stale claim → revert to "new" so another agent can pick it up
      // Only revert if stored status was new or in-progress
      if (storedStatus === "new" || storedStatus === "in-progress") {
        displayStatus = "new";
      }
    }
    // Orphaned (in-progress with no claim) → respect stored status as-is
    // For "none" claim health with non-in-progress status, just pass through

    return {
      displayStatus,
      storedStatus,
      claimHealth,
      claimAgeMs,
      claimTokenShort,
    };
  }

  countActiveClaims(items: FeedbackItem[]): number {
    return items.filter((item) => this.hasActiveClaim(item)).length;
  }
}
