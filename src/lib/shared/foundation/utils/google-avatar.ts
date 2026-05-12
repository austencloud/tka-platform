/**
 * Google Avatar URL Utilities
 *
 * Google profile picture URLs from OAuth can expire or fail due to:
 * 1. Signed token expiration (~60 minutes per Google's guidelines)
 * 2. Referrer blocking (403 errors)
 * 3. URL format changes over time
 *
 * This utility provides reliable ways to construct and validate Google avatar URLs.
 */

/**
 * Construct a Google profile picture URL from a Google user ID
 * This is more reliable than cached OAuth URLs which can expire.
 *
 * @param googleId - The user's Google ID (from providerData.uid)
 * @param size - Desired image size in pixels (default: 96)
 * @returns A Google profile picture URL, or null if no googleId
 */
export function constructGoogleAvatarUrl(
  googleId: string | null | undefined,
  size: number = 96
): string | null {
  if (!googleId) return null;

  // Google People API public photo URL format
  // This format is more stable than OAuth photoURL tokens
  return `https://lh3.googleusercontent.com/a/${googleId}=s${size}-c`;
}

/**
 * Check if a URL is a Google avatar URL
 */
export function isGoogleAvatarUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return (
    url.includes("lh3.googleusercontent.com") ||
    url.includes("googleusercontent.com/a/")
  );
}

/**
 * Extract the Google user ID from a Google avatar URL if possible
 *
 * Google avatar URLs typically look like:
 * - https://lh3.googleusercontent.com/a/ACg8ocJ...=s96-c
 * - https://lh3.googleusercontent.com/a-/ACg8ocJ...
 *
 * @param url - A Google avatar URL
 * @returns The extracted ID portion, or null if not extractable
 */
export function extractGoogleIdFromUrl(
  url: string | null | undefined
): string | null {
  if (!url) return null;

  // Match patterns like /a/ACg8ocJ... or /a-/ACg8ocJ...
  const match = url.match(/\/a[-]?\/([^=?/]+)/);
  if (match?.[1]) {
    return match[1];
  }

  return null;
}

/**
 * Try to get a working Google avatar URL with size variant
 *
 * @param originalUrl - The original avatar URL
 * @param googleId - Optional Google ID for fallback construction
 * @param size - Desired size (default: 96)
 * @returns A potentially working URL
 */
export function getGoogleAvatarWithSize(
  originalUrl: string | null | undefined,
  googleId?: string | null,
  size: number = 96
): string | null {
  // If we have a googleId, prefer constructing a fresh URL
  if (googleId) {
    return constructGoogleAvatarUrl(googleId, size);
  }

  // If we have an original URL, try to modify its size parameter
  if (originalUrl && isGoogleAvatarUrl(originalUrl)) {
    // Replace existing size parameter or add one
    const sizeParam = `=s${size}-c`;

    // Remove existing size params and add new one
    const baseUrl = originalUrl.replace(/=s\d+-c/, "").replace(/=s\d+/, "");
    return baseUrl + sizeParam;
  }

  return originalUrl || null;
}

/**
 * Validate that a URL is likely to work (basic format check)
 */
export function isValidImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;

  if (url.startsWith("data:image/")) return true;

  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}
