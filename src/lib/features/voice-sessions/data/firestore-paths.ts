/**
 * Firestore Collection Paths for Voice Sessions
 *
 * Centralized path definitions for voice session persistence.
 * Follows the same pattern as tika/data/firestore-paths.ts.
 */

// ============================================================================
// USER VOICE SESSION PATHS
// ============================================================================

/**
 * Path to a user's voice sessions collection
 * @example "users/abc123/voiceSessions"
 */
export function getUserVoiceSessionsPath(userId: string): string {
  return `users/${userId}/voiceSessions`;
}

/**
 * Path to a specific voice session
 * @example "users/abc123/voiceSessions/vs_abc123_xyz"
 */
export function getUserVoiceSessionPath(
  userId: string,
  sessionId: string
): string {
  return `users/${userId}/voiceSessions/${sessionId}`;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const VOICE_SESSION_COLLECTIONS = {
  SESSIONS: "voiceSessions",
} as const;

export const VOICE_SESSION_LIMITS = {
  /** Max sessions per user before oldest auto-delete */
  MAX_SESSIONS_PER_USER: 200,
  /** Default query limit for listing sessions */
  DEFAULT_QUERY_LIMIT: 20,
} as const;
