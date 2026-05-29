/**
 * Instagram Link Domain Model
 *
 * Data structure for linking Instagram videos to TKA sequences.
 * Phase 1: External linking (no API integration).
 */

/**
 * Instagram link data stored in sequence metadata
 */
export interface InstagramLink {
  /** Full Instagram post URL */
  readonly url: string;

  /** Extracted post ID (e.g., "ABC123xyz") */
  readonly postId: string;

  /** Instagram username (optional, for display) */
  readonly username?: string;

  /** When the link was added */
  readonly addedAt: Date;

  /** Optional caption/description */
  readonly caption?: string;
}

/**
 * Result of Instagram URL validation
 */
export interface InstagramUrlValidation {
  /** Whether the URL is valid */
  readonly isValid: boolean;

  /** Extracted post ID if valid */
  readonly postId: string | null;

  /** Extracted username if available */
  readonly username: string | null;

  /** Error message if invalid */
  readonly error: string | null;
}

/**
 * Instagram URL patterns for validation
 */
export const INSTAGRAM_URL_PATTERNS = {
  /** Standard post URL: https://www.instagram.com/p/ABC123/ */
  POST: /^https?:\/\/(?:www\.)?instagram\.com\/p\/([A-Za-z0-9_-]+)\/?/,

  /** Reel URL: https://www.instagram.com/reel/ABC123/ */
  REEL: /^https?:\/\/(?:www\.)?instagram\.com\/reel\/([A-Za-z0-9_-]+)\/?/,

  /** Profile post URL: https://www.instagram.com/username/p/ABC123/ */
  PROFILE_POST:
    /^https?:\/\/(?:www\.)?instagram\.com\/([A-Za-z0-9_.]+)\/p\/([A-Za-z0-9_-]+)\/?/,

  /** TV/IGTV URL: https://www.instagram.com/tv/ABC123/ */
  TV: /^https?:\/\/(?:www\.)?instagram\.com\/tv\/([A-Za-z0-9_-]+)\/?/,
} as const;

/**
 * Helper to create an Instagram link
 */
export function createInstagramLink(
  url: string,
  postId: string,
  options?: {
    username?: string;
    caption?: string;
  }
): InstagramLink {
  return {
    url,
    postId,
    ...(options?.username !== undefined && { username: options.username }),
    ...(options?.caption !== undefined && { caption: options.caption }),
    addedAt: new Date(),
  };
}

/**
 * Helper to check if a sequence has an Instagram link
 */
export function hasInstagramLink(metadata: Record<string, unknown>): boolean {
  return (
    metadata["instagramLink"] !== undefined &&
    metadata["instagramLink"] !== null
  );
}

/**
 * Helper to get Instagram link from sequence metadata
 */
export function getInstagramLink(
  metadata: Record<string, unknown>
): InstagramLink | null {
  const link = metadata["instagramLink"];
  if (!link || typeof link !== "object") {
    return null;
  }

  // Type guard and validation
  const linkObj = link as Record<string, unknown>;
  if (
    typeof linkObj["url"] !== "string" ||
    typeof linkObj["postId"] !== "string" ||
    !linkObj["url"] ||
    !linkObj["postId"]
  ) {
    return null;
  }

  return {
    url: linkObj["url"],
    postId: linkObj["postId"],
    ...(typeof linkObj["username"] === "string" && {
      username: linkObj["username"],
    }),
    ...(typeof linkObj["caption"] === "string" && {
      caption: linkObj["caption"],
    }),
    addedAt: linkObj["addedAt"]
      ? new Date(linkObj["addedAt"] as string | number | Date)
      : new Date(),
  };
}
