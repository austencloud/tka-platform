import type { FeedbackItem, FeedbackStatus } from "../../domain/models/feedback-models";

/**
 * Claim health status for UI indicators
 */
export type ClaimHealth =
  | "active"      // Has claim, not stale
  | "stale"       // Has claim, but older than threshold
  | "orphaned"    // Status is "in-progress" but no claim
  | "none";       // No claim (normal for new/in-review/completed)

/**
 * Effective status derived from stored status + claim state
 *
 * The key insight: "in-progress" should be derived from claim state,
 * not stored as a status. An item is "in-progress" if and only if
 * it has an active, non-stale claim.
 */
export interface EffectiveStatus {
  /** The status to display/use for grouping */
  displayStatus: FeedbackStatus;

  /** The stored status in Firestore (may differ from displayStatus) */
  storedStatus: FeedbackStatus;

  /** Claim health for UI indicators */
  claimHealth: ClaimHealth;

  /** Claim age in milliseconds (if claimed) */
  claimAgeMs?: number;

  /** Short claim token for display (first 8 chars) */
  claimTokenShort?: string;
}

export interface IClaimStatusDeriver {
  /**
   * Derive effective status from item's stored status and claim state
   *
   * Rules:
   * - Item with active claim (non-stale) → "in-progress"
   * - Item with stale claim → back to "new" (available for reclaim)
   * - Item with status="in-progress" but no claim → "new" (orphaned, auto-fix)
   * - All other statuses pass through unchanged
   */
  deriveEffectiveStatus(item: FeedbackItem): EffectiveStatus;

  /**
   * Check if an item has an active (non-stale) claim
   */
  hasActiveClaim(item: FeedbackItem): boolean;

  /**
   * Check if an item's claim is stale (older than threshold)
   */
  isClaimStale(item: FeedbackItem): boolean;

  /**
   * Get the stale threshold in milliseconds
   */
  getStaleThresholdMs(): number;

  /**
   * Count items with active claims (for WIP limit)
   * This is the correct way to count "in progress" work
   */
  countActiveClaims(items: FeedbackItem[]): number;
}
