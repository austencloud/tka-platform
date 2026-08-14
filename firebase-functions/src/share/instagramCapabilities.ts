import { GRAPH_VERSION } from "./metaGraphClient";
import type { MetaPublishFailureCode } from "./metaPublishPolicy";

interface TimestampLike {
  toMillis(): number;
}

export interface InstagramCapabilityConnection {
  igUserId: string;
  username: string;
  accountType?: "BUSINESS" | "CREATOR" | "UNKNOWN";
  graphVersion?: string;
  appAccess?: "standard" | "advanced" | "unknown";
  permissions?: Record<string, "granted" | "declined" | "expired" | "unknown">;
  expiresAt: TimestampLike;
  verifiedAt?: TimestampLike;
}

export type InstagramCapabilityRecoveryAction =
  | "none"
  | "connect-instagram"
  | "connect-facebook"
  | "reconnect"
  | "upgrade-account"
  | "app-review-pending"
  | "finish-in-instagram";

export type InstagramFeatureKey =
  | "image"
  | "reel"
  | "carousel"
  | "story"
  | "trial-reel"
  | "alt-text"
  | "cover"
  | "feed-distribution"
  | "user-tags"
  | "location"
  | "collaborators"
  | "product-tags"
  | "partnership-labels"
  | "ai-disclosure"
  | "api-audio"
  | "comments"
  | "insights"
  | "schedule";

export interface InstagramCapabilityResult {
  available: boolean;
  reasonCode: MetaPublishFailureCode | null;
  recoveryAction: InstagramCapabilityRecoveryAction;
}

export interface InstagramCapabilitySnapshot {
  schemaVersion: 1;
  id: string;
  accountId: string;
  username: string;
  accountType: "BUSINESS" | "CREATOR" | "UNKNOWN";
  route: "instagram-login" | "facebook-login";
  graphVersion: string;
  appAccess: "standard" | "advanced" | "unknown";
  permissions: Record<string, "granted" | "declined" | "expired" | "unknown">;
  features: Record<InstagramFeatureKey, InstagramCapabilityResult>;
  verifiedAtMs: number;
  expiresAtMs: number;
}

function available(): InstagramCapabilityResult {
  return { available: true, reasonCode: null, recoveryAction: "none" };
}

function unavailable(
  reasonCode: MetaPublishFailureCode,
  recoveryAction: InstagramCapabilityRecoveryAction
): InstagramCapabilityResult {
  return { available: false, reasonCode, recoveryAction };
}

function basePublishingCapability(
  connection: InstagramCapabilityConnection,
  nowMs: number
): InstagramCapabilityResult {
  if (connection.expiresAt.toMillis() <= nowMs) {
    return unavailable("meta/token-expired", "reconnect");
  }
  if (!connection.accountType) {
    return unavailable("meta/account-type-unverified", "reconnect");
  }
  if (
    connection.accountType !== "BUSINESS" &&
    connection.accountType !== "CREATOR"
  ) {
    return unavailable("meta/account-type-required", "upgrade-account");
  }
  if (
    connection.permissions?.instagram_business_content_publish !== "granted"
  ) {
    return unavailable("meta/permission-missing", "reconnect");
  }
  return available();
}

export function buildInstagramCapabilitySnapshot(
  connection: InstagramCapabilityConnection,
  nowMs = Date.now()
): InstagramCapabilitySnapshot {
  const base = basePublishingCapability(connection, nowMs);
  const facebookOnly = unavailable(
    "meta/facebook-capability-required",
    "connect-facebook"
  );
  const comments =
    base.available &&
    connection.permissions?.instagram_business_manage_comments === "granted"
      ? available()
      : base.available
        ? unavailable("meta/permission-missing", "reconnect")
        : base;
  const insights =
    base.available &&
    connection.permissions?.instagram_business_manage_insights === "granted"
      ? available()
      : base.available
        ? unavailable("meta/permission-missing", "reconnect")
        : base;

  const accountType = connection.accountType ?? "UNKNOWN";
  const verifiedAtMs = connection.verifiedAt?.toMillis() ?? nowMs;
  const expiresAtMs = connection.expiresAt.toMillis();

  return {
    schemaVersion: 1,
    id: `instagram-login:${connection.igUserId}:${verifiedAtMs}`,
    accountId: connection.igUserId,
    username: connection.username,
    accountType,
    route: "instagram-login",
    graphVersion: connection.graphVersion ?? GRAPH_VERSION,
    appAccess: connection.appAccess ?? "unknown",
    permissions: connection.permissions ?? {},
    features: {
      image: base,
      reel: base,
      carousel: base,
      story: base,
      "trial-reel": base,
      "alt-text": base,
      cover: base,
      "feed-distribution": base,
      "user-tags": base,
      location: base,
      collaborators: facebookOnly,
      "product-tags": facebookOnly,
      "partnership-labels": facebookOnly,
      "ai-disclosure": base,
      "api-audio": facebookOnly,
      comments,
      insights,
      schedule: base,
    },
    verifiedAtMs,
    expiresAtMs,
  };
}
