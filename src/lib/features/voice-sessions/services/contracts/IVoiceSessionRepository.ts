/**
 * Persistence for voice command sessions.
 *
 * Stores sessions in Firestore under users/{userId}/voiceSessions/{sessionId}.
 * Follows the TikaSessionRepository pattern but simpler (no review workflow).
 */

import type {
  VoiceSession,
  VoiceSessionPreview,
} from "$lib/shared/voice-control/domain/voice-session-types";

export interface VoiceSessionQueryOptions {
  limit?: number;
  sortDirection?: "asc" | "desc";
}

export interface IVoiceSessionRepository {
  /** Save a recorded session. Sets userId from auth state. */
  saveSession(session: VoiceSession): Promise<VoiceSession>;

  /** Load a session by ID (includes events). */
  getSession(sessionId: string): Promise<VoiceSession | null>;

  /** List session previews (no events). */
  listSessions(options?: VoiceSessionQueryOptions): Promise<VoiceSessionPreview[]>;

  /** Delete a session. */
  deleteSession(sessionId: string): Promise<void>;

  /** Delete oldest sessions if count exceeds MAX_SESSIONS_PER_USER. */
  enforceSessionLimit(): Promise<number>;
}
