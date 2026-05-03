/**
 * Instagram Link Service Implementation
 *
 * Handles Instagram URL validation, parsing, and deep linking.
 * Phase 1: External linking without API integration.
 */

import type {
  InstagramLink,
  InstagramUrlValidation,
} from "../../domain/models/InstagramLink";
import {
  INSTAGRAM_URL_PATTERNS,
  createInstagramLink,
} from "../../domain/models/InstagramLink";

export class InstagramLinker {
  /**
   * Validate an Instagram URL and extract metadata
   */
  validateUrl(url: string): InstagramUrlValidation {
    // Trim whitespace
    const trimmedUrl = url.trim();

    // Check if empty
    if (!trimmedUrl) {
      return {
        isValid: false,
        postId: null,
        username: null,
        error: "URL cannot be empty",
      };
    }

    // Try to extract post ID using all patterns
    const postId = this.extractPostId(trimmedUrl);

    if (!postId) {
      return {
        isValid: false,
        postId: null,
        username: null,
        error:
          "Invalid Instagram URL. Please use a valid Instagram post, reel, or video URL.",
      };
    }

    // Extract username if available
    const username = this.extractUsername(trimmedUrl);

    return {
      isValid: true,
      postId,
      username,
      error: null,
    };
  }

  /**
   * Extract post ID from Instagram URL
   */
  extractPostId(url: string): string | null {
    const trimmedUrl = url.trim();

    // Try each pattern
    for (const pattern of Object.values(INSTAGRAM_URL_PATTERNS)) {
      const match = trimmedUrl.match(pattern);
      if (match) {
        // For PROFILE_POST pattern, post ID is in group 2
        // For all others, it's in group 1
        return (match[2] || match[1]) ?? null;
      }
    }

    return null;
  }

  /**
   * Extract username from Instagram URL (if present)
   */
  extractUsername(url: string): string | null {
    const trimmedUrl = url.trim();

    // Only PROFILE_POST pattern contains username
    const match = trimmedUrl.match(INSTAGRAM_URL_PATTERNS.PROFILE_POST);
    if (match?.[1]) {
      return match[1];
    }

    return null;
  }

  /**
   * Generate Instagram URL from post ID
   */
  generateUrl(postId: string): string {
    return `https://www.instagram.com/p/${postId}/`;
  }

  /**
   * Open Instagram post in new tab or app (deep linking)
   */
  openInstagramPost(url: string, preferApp: boolean = false): void {
    // Validate URL first
    const validation = this.validateUrl(url);
    if (!validation.isValid) {
      console.error("Invalid Instagram URL:", validation.error);
      return;
    }

    // For mobile devices, try to open in Instagram app
    if (preferApp && this.isMobileDevice()) {
      // Try Instagram app deep link first
      const appUrl = this.convertToAppUrl(url);

      // Try to open in app, fallback to web
      const appWindow = window.open(appUrl, "_blank");

      // If app didn't open, fallback to web URL after short delay
      setTimeout(() => {
        if (!appWindow || appWindow.closed) {
          window.open(url, "_blank", "noopener,noreferrer");
        }
      }, 500);
    } else {
      // Open in new tab (web)
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  /**
   * Create an Instagram link object from URL
   */
  createLink(
    url: string,
    options?: {
      caption?: string;
    }
  ): InstagramLink | null {
    const validation = this.validateUrl(url);

    if (!validation.isValid || !validation.postId) {
      return null;
    }

    return createInstagramLink(url, validation.postId, {
      ...(validation.username && { username: validation.username }),
      ...(options?.caption && { caption: options.caption }),
    });
  }

  /**
   * Check if URL is a valid Instagram URL
   */
  isInstagramUrl(url: string): boolean {
    return this.extractPostId(url) !== null;
  }

  /**
   * Convert web URL to Instagram app URL scheme
   * @private
   */
  private convertToAppUrl(url: string): string {
    const postId = this.extractPostId(url);
    if (!postId) {
      return url;
    }

    // Instagram app URL scheme
    return `instagram://media?id=${postId}`;
  }

  /**
   * Detect if user is on a mobile device
   * @private
   */
  private isMobileDevice(): boolean {
    if (typeof navigator === "undefined") {
      return false;
    }

    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
  }
}
