/**
 * ITikaSessionRepository - Contract for Tika Session Persistence
 *
 * Defines operations for saving and loading Tika conversations.
 */

import type { UIMessage } from "ai";
import type {
  TikaSession,
  TikaSessionPreview,
  TikaSessionQueryOptions,
} from "../../domain/models/tika-conversation-models";

export interface ITikaSessionRepository {
  /**
   * Save a session (create or update)
   * @param sessionId - Existing session ID or undefined for new
   * @param messages - Current conversation messages
   * @returns The saved session with its ID
   */
  saveSession(sessionId: string | undefined, messages: UIMessage[]): Promise<TikaSession>;

  /**
   * Load a specific session by ID
   * @param sessionId - The session ID to load
   * @returns The session or null if not found
   */
  getSession(sessionId: string): Promise<TikaSession | null>;

  /**
   * List session previews (for history drawer)
   * @param options - Query options (limit, sort direction)
   * @returns Array of session previews
   */
  listSessions(options?: TikaSessionQueryOptions): Promise<TikaSessionPreview[]>;

  /**
   * Delete a session
   * @param sessionId - The session ID to delete
   */
  deleteSession(sessionId: string): Promise<void>;

  /**
   * Subscribe to session list changes (real-time updates)
   * @param callback - Called with updated session list
   * @returns Unsubscribe function
   */
  subscribeToSessions(
    callback: (sessions: TikaSessionPreview[]) => void,
    options?: TikaSessionQueryOptions
  ): () => void;

  /**
   * Flag a session for human review
   * @param sessionId - The session ID to flag
   * @param flagged - Whether to flag (true) or unflag (false)
   */
  flagForReview(sessionId: string, flagged: boolean): Promise<void>;

  /**
   * Get all sessions flagged for review
   * @returns Array of flagged sessions
   */
  getFlaggedSessions(): Promise<TikaSession[]>;
}
