/**
 * Broadcast Repository Interface
 *
 * Contract for subscribing to the live broadcast system.
 * Provides real-time updates of the current broadcast and history.
 */

import type {
  BroadcastStateClient,
  BroadcastHistoryEntry,
  ServerTimeResponse,
} from "../../domain/models/broadcast-models";

/**
 * Callback for broadcast state updates.
 */
export type BroadcastStateCallback = (state: BroadcastStateClient | null) => void;

/**
 * Callback for history updates.
 */
export type BroadcastHistoryCallback = (entries: BroadcastHistoryEntry[]) => void;

/**
 * Repository for accessing the live broadcast.
 */
export interface IBroadcastRepository {
  /**
   * Subscribe to the current broadcast state.
   * Returns an unsubscribe function.
   */
  subscribeToBroadcast(callback: BroadcastStateCallback): () => void;

  /**
   * Subscribe to broadcast history.
   * Returns an unsubscribe function.
   */
  subscribeToHistory(limit: number, callback: BroadcastHistoryCallback): () => void;

  /**
   * Get the current server time for synchronization.
   */
  getServerTime(): Promise<ServerTimeResponse>;

  /**
   * Calculate the server time offset (client time - server time).
   * Positive means client is ahead, negative means client is behind.
   */
  calculateServerTimeOffset(): Promise<number>;

  /**
   * Get the current beat position based on server time.
   */
  getCurrentStepPosition(
    startedAtMs: number,
    durationMs: number,
    totalSteps: number,
    beatsPerMinute: number
  ): number;
}
