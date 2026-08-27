/**
 * Firestore Collection Paths for Tika Module
 *
 * Centralized path definitions for Tika conversation persistence.
 */


/**
 * Path to a user's Tika conversations collection
 * @example "users/abc123/tikaConversations"
 */
export function getUserTikaConversationsPath(userId: string): string {
  return `users/${userId}/tikaConversations`;
}

/**
 * Path to a specific Tika conversation
 * @example "users/abc123/tikaConversations/conv456"
 */
export function getUserTikaConversationPath(
  userId: string,
  conversationId: string
): string {
  return `users/${userId}/tikaConversations/${conversationId}`;
}

// ============================================================================
// USER TIKA INTERACTION PATHS
// ============================================================================

/**
 * Path to a user's Tika topic interactions collection
 * @example "users/abc123/tikaInteractions"
 */
export function getUserTikaInteractionsPath(userId: string): string {
  return `users/${userId}/tikaInteractions`;
}

/**
 * Path to a specific Tika topic interaction document
 * @example "users/abc123/tikaInteractions/letter-a"
 */
export function getUserTikaInteractionPath(
  userId: string,
  topicId: string
): string {
  return `users/${userId}/tikaInteractions/${topicId}`;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Firestore collection names used by the Tika module
 */
export const TIKA_COLLECTIONS = {
  /** User's Tika conversations */
  CONVERSATIONS: "tikaConversations",
  /** User's Tika topic interaction tracking */
  INTERACTIONS: "tikaInteractions",
} as const;

/**
 * Limits for Tika operations
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
