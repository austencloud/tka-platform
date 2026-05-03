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
   * @returns The saved session with its ID
   */
  saveSession(
    sessionId: string | undefined,
    messages: UIMessage[]
  ): Promise<TikaSession>;

  /**
   * Load a specific session by ID
   */
  getSession(sessionId: string): Promise<TikaSession | null>;

  /**
   * List session previews (for history drawer)
   */
  listSessions(options?: TikaSessionQueryOptions): Promise<TikaSessionPreview[]>;

  deleteSession(sessionId: string): Promise<void>;

  /**
   * Subscribe to session list changes (real-time updates)
   * @returns Unsubscribe function
   */
  subscribeToSessions(
    callback: (sessions: TikaSessionPreview[]) => void,
    options?: TikaSessionQueryOptions,
    onError?: (error: Error) => void
  ): () => void;

  /**
   * Flag a session for human review
   */
  flagForReview(sessionId: string, flagged: boolean): Promise<void>;

  getFlaggedSessions(): Promise<TikaSession[]>;

  /**
   * Get sessions in the review queue by status
   */
  getReviewQueue(options?: ReviewQueueQueryOptions): Promise<TikaSession[]>;

  /**
   * Atomically claim a session for review (prevents duplicate reviews)
   * @param claimedBy - Who is claiming: "claude-tika" or user ID
   * @returns The claimed session, or null if already claimed
   */
  claimForReview(
    sessionId: string,
    claimedBy: string
  ): Promise<TikaSession | null>;

  /**
   * Submit review results for a session
   */
  submitReview(sessionId: string, result: ReviewResult): Promise<TikaSession>;

  /**
   * Add human notes to a session before review
   */
  addReviewNotes(sessionId: string, notes: string): Promise<void>;

  updateReviewStatus(sessionId: string, status: ReviewStatus): Promise<void>;

  archiveReview(sessionId: string): Promise<void>;
}
