/**
 * Instagram Media Types and Validation
 *
 * Simple types for Instagram carousel media items.
 * No OAuth/API - just for local bundling before native share.
 */

export interface InstagramMediaItem {
  type: "IMAGE" | "VIDEO";
  blob: Blob;
  url: string;
  order: number;
  filename: string;
}

// Legacy types for backwards compatibility (not actively used in new share flow)
export interface InstagramPostStatus {
  status: "uploading" | "processing" | "completed" | "failed";
  progress?: number;
  message?: string;
  error?: string;
  postUrl?: string;
}

export const INSTAGRAM_MEDIA_CONSTRAINTS = {
  CAROUSEL_MIN_ITEMS: 2,
  CAROUSEL_MAX_ITEMS: 10,
  IMAGE_MAX_SIZE: 8 * 1024 * 1024, // 8MB
  VIDEO_MAX_SIZE: 100 * 1024 * 1024, // 100MB
  VIDEO_MAX_DURATION: 60, // seconds
  LOOPTION_MAX_LENGTH: 2200,
  HASHTAG_MAX_COUNT: 30,
} as const;

export interface MediaValidationResult {
  isValid: boolean;
  error?: string;
}

export function validateMediaItem(
  item: InstagramMediaItem
): MediaValidationResult {
  // Size validation
  const maxSize =
    item.type === "VIDEO"
      ? INSTAGRAM_MEDIA_CONSTRAINTS.VIDEO_MAX_SIZE
      : INSTAGRAM_MEDIA_CONSTRAINTS.IMAGE_MAX_SIZE;

  if (item.blob.size > maxSize) {
    return {
      isValid: false,
      error: `${item.type} exceeds maximum size of ${maxSize / (1024 * 1024)}MB`,
    };
  }

  return { isValid: true };
}
