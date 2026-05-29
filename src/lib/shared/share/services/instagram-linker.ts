/**
 * Instagram Link Functions
 *
 * Handles Instagram URL validation, parsing, and deep linking.
 */

import type {
  InstagramLink,
  InstagramUrlValidation,
} from "../domain/models/instagram-link";
import {
  INSTAGRAM_URL_PATTERNS,
  createInstagramLink,
} from "../domain/models/instagram-link";

export function extractPostId(url: string): string | null {
  const trimmedUrl = url.trim();

  for (const pattern of Object.values(INSTAGRAM_URL_PATTERNS)) {
    const match = trimmedUrl.match(pattern);
    if (match) {
      return (match[2] || match[1]) ?? null;
    }
  }

  return null;
}

export function extractUsername(url: string): string | null {
  const trimmedUrl = url.trim();

  const match = trimmedUrl.match(INSTAGRAM_URL_PATTERNS.PROFILE_POST);
  if (match?.[1]) {
    return match[1];
  }

  return null;
}

export function validateUrl(url: string): InstagramUrlValidation {
  const trimmedUrl = url.trim();

  if (!trimmedUrl) {
    return {
      isValid: false,
      postId: null,
      username: null,
      error: "URL cannot be empty",
    };
  }

  const postId = extractPostId(trimmedUrl);

  if (!postId) {
    return {
      isValid: false,
      postId: null,
      username: null,
      error: "Invalid Instagram URL. Please use a valid Instagram post, reel, or video URL.",
    };
  }

  const username = extractUsername(trimmedUrl);

  return {
    isValid: true,
    postId,
    username,
    error: null,
  };
}

export function generateUrl(postId: string): string {
  return `https://www.instagram.com/p/${postId}/`;
}

function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

function convertToAppUrl(url: string): string {
  const postId = extractPostId(url);
  if (!postId) {
    return url;
  }
  return `instagram://media?id=${postId}`;
}

export function openInstagramPost(url: string, preferApp: boolean = false): void {
  const validation = validateUrl(url);
  if (!validation.isValid) {
    console.error("Invalid Instagram URL:", validation.error);
    return;
  }

  if (preferApp && isMobileDevice()) {
    const appUrl = convertToAppUrl(url);

    const appWindow = window.open(appUrl, "_blank");

    setTimeout(() => {
      if (!appWindow || appWindow.closed) {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    }, 500);
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

export function createLink(
  url: string,
  options?: {
    caption?: string;
  }
): InstagramLink | null {
  const validation = validateUrl(url);

  if (!validation.isValid || !validation.postId) {
    return null;
  }

  return createInstagramLink(url, validation.postId, {
    ...(validation.username && { username: validation.username }),
    ...(options?.caption && { caption: options.caption }),
  });
}

export function isInstagramUrl(url: string): boolean {
  return extractPostId(url) !== null;
}
