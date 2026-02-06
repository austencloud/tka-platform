/**
 * Utility functions for generating responsive image srcset attributes.
 *
 * TKA gallery images follow this naming convention:
 * - {name}.webp - full size (~800-1200px wide)
 * - {name}_small.webp - small variant (~200-300px wide)
 * - {name}_medium.webp - medium variant (~400-600px wide)
 */

export interface SrcsetVariant {
  url: string;
  width: number;
}

/**
 * Standard width descriptors for gallery image variants.
 * These approximate the actual rendered widths.
 */
export const VARIANT_WIDTHS = {
  small: 300,
  medium: 600,
  full: 1200,
} as const;

/**
 * Generate srcset string from a base image URL.
 * Assumes the naming convention: {name}.webp, {name}_small.webp, {name}_medium.webp
 *
 * @param baseUrl - The URL to the full-size image (e.g., "/gallery/A/A_ver1.webp")
 * @returns srcset string for use in <img> element, or undefined if no valid URL
 *
 * @example
 * generateSrcset("/gallery/A/A_ver1.webp")
 * // Returns: "/gallery/A/A_ver1_small.webp 300w, /gallery/A/A_ver1_medium.webp 600w, /gallery/A/A_ver1.webp 1200w"
 */
export function generateSrcset(
  baseUrl: string | undefined
): string | undefined {
  if (!baseUrl) return undefined;

  // Extract base name and extension
  const extIndex = baseUrl.lastIndexOf(".");
  if (extIndex === -1) return undefined;

  const baseName = baseUrl.slice(0, extIndex);
  const extension = baseUrl.slice(extIndex);

  // Generate variant URLs
  const smallUrl = `${baseName}_small${extension}`;
  const mediumUrl = `${baseName}_medium${extension}`;

  return `${smallUrl} ${VARIANT_WIDTHS.small}w, ${mediumUrl} ${VARIANT_WIDTHS.medium}w, ${baseUrl} ${VARIANT_WIDTHS.full}w`;
}

/**
 * Generate appropriate sizes attribute based on card display context.
 * Uses container query breakpoints that match the gallery grid.
 *
 * @param context - The display context ('grid' | 'detail' | 'fullscreen')
 * @returns sizes attribute string
 */
export function generateSizes(
  context: "grid" | "detail" | "fullscreen" = "grid"
): string {
  switch (context) {
    case "fullscreen":
      return "100vw";
    case "detail":
      return "(max-width: 768px) 100vw, 50vw";
    case "grid":
    default:
      // Gallery grid: cards are typically 150-400px depending on viewport
      return "(max-width: 480px) 50vw, (max-width: 768px) 33vw, (max-width: 1200px) 25vw, 20vw";
  }
}

/**
 * Get the smallest variant URL for lazy loading optimization.
 * Useful for placeholder images or low-bandwidth scenarios.
 */
export function getSmallVariantUrl(
  baseUrl: string | undefined
): string | undefined {
  if (!baseUrl) return undefined;

  const extIndex = baseUrl.lastIndexOf(".");
  if (extIndex === -1) return undefined;

  const baseName = baseUrl.slice(0, extIndex);
  const extension = baseUrl.slice(extIndex);

  return `${baseName}_small${extension}`;
}
