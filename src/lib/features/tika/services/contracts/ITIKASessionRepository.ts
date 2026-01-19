/**
 * ITIKASessionRepository - Contract for TIKA Session Persistence
 *
 * Defines operations for saving and loading TIKA conversations.
 */

import type { UIMessage } from "ai";
import type {
  TIKASession,
  TIKASessionPreview,
  TIKASessionQueryOptions,
} from "../../domain/models/tika-conversation-models";

export interface ITIKASessionRepository {
  /**
   * Save a session (create or update)
   * @param sessionId - Existing session ID or undefined for new
   * @param messages - Current conversation messages
   * @returns The saved session with its ID
   */
  saveSession(sessionId: string | undefined, messages: UIMessage[]): Promise<TIKASession>;

  /**
   * Load a specific session by ID
   * @param sessionId - The session ID to load
   * @returns The session or null if not found
   */
  getSession(sessionId: string): Promise<TIKASession | null>;

  /**
   * List session previews (for history drawer)
   * @param options - Query options (limit, sort direction)
   * @returns Array of session previews
   */
  listSessions(options?: TIKASessionQueryOptions): Promise<TIKASessionPreview[]>;

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
    callback: (sessions: TIKASessionPreview[]) => void,
    options?: TIKASessionQueryOptions
  ): () => void;
}
