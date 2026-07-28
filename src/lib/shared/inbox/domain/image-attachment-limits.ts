/**
 * The one place the message-attachment image limits live.
 *
 * MessageAttachmentPicker declared these inline and share intake needs exactly
 * the same numbers - intake bypasses the picker entirely, so a second copy is
 * a security boundary that can drift. Both import from here.
 */

/** Matches the picker's original MAX_IMAGE_BYTES. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/**
 * Deliberately not `image/*`. HEIC is Android's default camera format and the
 * composer cannot decode it, so advertising it would mean rejecting the user
 * AFTER they already picked TKA from the share sheet.
 */
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type AllowedImageType = (typeof IMAGE_TYPES)[number];

/** `accept` attribute value for a file input. */
export const IMAGE_ACCEPT = IMAGE_TYPES.join(",");

const ALLOWED = new Set<string>(IMAGE_TYPES);

export function isAllowedImageType(
  mimeType: string
): mimeType is AllowedImageType {
  return ALLOWED.has(mimeType.trim().toLowerCase());
}
