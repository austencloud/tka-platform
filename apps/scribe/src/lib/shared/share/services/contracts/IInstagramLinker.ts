/**
 * Instagram Link Service Contract
 *
 * Service for managing Instagram video links on TKA sequences.
 * Phase 1: External linking without API integration.
 */

import type {
  InstagramLink,
  InstagramUrlValidation,
} from "../../domain/models/InstagramLink";

export interface IInstagramLinker {
  /**
   * Validate an Instagram URL and extract metadata
   * @param url - Instagram URL to validate
   * @returns Validation result with extracted data
   */
  validateUrl(url: string): InstagramUrlValidation;

  /**
   * Extract post ID from Instagram URL
   * @param url - Instagram URL
   * @returns Post ID or null if invalid
   */
  extractPostId(url: string): string | null;

  /**
   * Extract username from Instagram URL (if present)
   * @param url - Instagram URL
   * @returns Username or null if not found
   */
  extractUsername(url: string): string | null;

  /**
   * Generate Instagram URL from post ID
   * @param postId - Instagram post ID
   * @returns Full Instagram URL
   */
  generateUrl(postId: string): string;

  /**
   * Open Instagram post in new tab or app (deep linking)
   * @param url - Instagram URL to open
   * @param preferApp - Whether to try opening in Instagram app (mobile)
   */
  openInstagramPost(url: string, preferApp?: boolean): void;

  /**
   * Create an Instagram link object from URL
   * @param url - Instagram URL
   * @param options - Optional metadata
   * @returns Instagram link object or null if invalid
   */
  createLink(
    url: string,
    options?: {
      caption?: string;
    }
  ): InstagramLink | null;

  /**
   * Check if URL is a valid Instagram URL
   * @param url - URL to check
   * @returns True if valid Instagram URL
   */
  isInstagramUrl(url: string): boolean;
}
