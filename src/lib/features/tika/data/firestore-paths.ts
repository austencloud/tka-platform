/**
 * Firestore Collection Paths for TIKA Module
 *
 * Centralized path definitions for TIKA conversation persistence.
 */

// ============================================================================
// USER TIKA PATHS
// ============================================================================

/**
 * Path to a user's TIKA conversations collection
 * @example "users/abc123/tikaConversations"
 */
export function getUserTIKAConversationsPath(userId: string): string {
  return `users/${userId}/tikaConversations`;
}

/**
 * Path to a specific TIKA conversation
 * @example "users/abc123/tikaConversations/conv456"
 */
export function getUserTIKAConversationPath(
  userId: string,
  conversationId: string
): string {
  return `users/${userId}/tikaConversations/${conversationId}`;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Firestore collection names used by the TIKA module
 */
export const TIKA_COLLECTIONS = {
  /** User's TIKA conversations */
  CONVERSATIONS: "tikaConversations",
} as const;

/**
 * Limits for TIKA operations
 */
export const TIKA_LIMITS = {
  /** Max conversations per user */
  MAX_CONVERSATIONS_PER_USER: 100,

  /** Default query limit for listing conversations */
  DEFAULT_QUERY_LIMIT: 20,

  /** Auto-save debounce delay in milliseconds */
  AUTO_SAVE_DEBOUNCE_MS: 2000,

  /** Minimum messages before auto-save triggers */
  MIN_MESSAGES_FOR_SAVE: 2,
} as const;
