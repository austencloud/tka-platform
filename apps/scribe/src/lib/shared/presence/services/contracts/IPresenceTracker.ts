/**
 * Presence Service Interface
 *
 * Manages real-time user presence using Firebase Realtime Database.
 * Uses activity-based detection (like Facebook) to show actual user engagement.
 */

import type {
  UserPresence,
  UserPresenceWithId,
  PresenceStats,
  ActivityStatus,
} from "../../domain/models/presence-models";

export interface IPresenceTracker {
  /**
   * Initialize presence tracking for the current user
   * Sets up online status, disconnect handlers, and activity tracking
   */
  initialize(): Promise<void>;

  /**
   * Update current user's location (module/tab)
   * Also triggers activity update since navigation is user activity
   * @param module - Current module ID
   * @param tab - Current tab ID (optional)
   */
  updateLocation(module: string, tab?: string | null): Promise<void>;

  /**
   * Set user as offline (called on logout)
   * Stops activity tracking and marks user offline
   */
  goOffline(): Promise<void>;

  /**
   * Get current user's presence data
   */
  getCurrentPresence(): UserPresence | null;

  /**
   * Subscribe to all users' presence (admin only)
   * Users are sorted by activity status: active > away > offline
   * @param callback - Called when presence data changes
   * @returns Unsubscribe function
   */
  subscribeToAllPresence(
    callback: (users: UserPresenceWithId[]) => void
  ): () => void;

  /**
   * Subscribe to a specific user's presence
   * @param userId - User ID to subscribe to
   * @param callback - Called when presence changes
   * @returns Unsubscribe function
   */
  subscribeToUserPresence(
    userId: string,
    callback: (presence: UserPresence | null) => void
  ): () => void;

  /**
   * Get aggregated presence stats (admin only)
   * Now includes byStatus breakdown
   */
  getPresenceStats(): Promise<PresenceStats>;

  /**
   * Check if a specific user is actively online (not just connected)
   * Returns true only if user has interacted within IDLE_TIMEOUT_MINUTES
   * @param userId - User ID to check
   */
  isUserOnline(userId: string): Promise<boolean>;

  /**
   * Get detailed activity status for a user
   * @param userId - User ID to check
   * @returns "active" | "away" | "offline"
   */
  getUserActivityStatus(userId: string): Promise<ActivityStatus>;
}
