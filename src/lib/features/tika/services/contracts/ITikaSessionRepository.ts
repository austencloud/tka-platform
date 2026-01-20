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
  ReviewQueueQueryOptions,
  ReviewResult,
  ReviewStatus,
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

  // ─────────────────────────────────────────────────────────────────────────
  // REVIEW WORKFLOW METHODS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get sessions in the review queue by status
   * @param options - Filter by status and limit
   * @returns Array of sessions matching the query
   */
  getReviewQueue(options?: ReviewQueueQueryOptions): Promise<TikaSession[]>;

  /**
   * Atomically claim a session for review (prevents duplicate reviews)
   * @param sessionId - The session ID to claim
   * @param claimedBy - Who is claiming: "claude-tika" or user ID
   * @returns The claimed session, or null if already claimed
   */
  claimForReview(sessionId: string, claimedBy: string): Promise<TikaSession | null>;

  /**
   * Submit review results for a session
   * @param sessionId - The session ID
   * @param result - The review result (grade, notes, etc.)
   * @returns The updated session
   */
  submitReview(sessionId: string, result: ReviewResult): Promise<TikaSession>;

  /**
   * Add human notes to a session before review
   * @param sessionId - The session ID
   * @param notes - Human-added context notes
   */
  addReviewNotes(sessionId: string, notes: string): Promise<void>;

  /**
   * Update the review status of a session
   * @param sessionId - The session ID
   * @param status - The new status
   */
  updateReviewStatus(sessionId: string, status: ReviewStatus): Promise<void>;

  /**
   * Archive a reviewed session
   * @param sessionId - The session ID to archive
   */
  archiveReview(sessionId: string): Promise<void>;
}
