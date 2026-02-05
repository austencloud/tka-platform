/**
 * User Activity Tracker Interface (Admin)
 *
 * Service for admins to view all users' activity and presence.
 */

import type { ActivityEvent } from "$lib/shared/analytics/domain/models/ActivityEvent";
import type { UserPresenceWithId } from "$lib/shared/presence/domain/models/presence-models";

/**
 * User with presence and recent activity
 */
export interface UserWithActivity {
  userId: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  online: boolean;
  lastSeen: number;
  currentModule?: string;
  currentTab?: string | null;
  sessionId?: string;
  recentEventCount?: number;
}

/**
 * Session summary for a user
 */
export interface SessionSummary {
  sessionId: string;
  startedAt: Date;
  endedAt?: Date;
  duration: number;
  eventCount: number;
  modules: string[];
}

/**
 * Options for querying user activity
 */
export interface UserActivityQueryOptions {
  userId: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  sessionId?: string;
}

export interface IUserActivityTracker {
  /**
   * Get all users with presence data, sorted by online status and last seen
   */
  getAllUsersWithPresence(): Promise<UserWithActivity[]>;

  /**
   * Subscribe to real-time presence updates for all users
   * @param callback - Called when presence data changes
   * @returns Unsubscribe function
   */
  subscribeToAllPresence(
    callback: (users: UserPresenceWithId[]) => void
  ): () => void;

  /**
   * Subscribe to ALL users (from Firestore) merged with presence data
   * Users without presence data will show "never" activity
   * @param callback - Called when user list or presence changes
   * @returns Unsubscribe function
   */
  subscribeToAllUsers(
    callback: (users: UserPresenceWithId[]) => void
  ): () => void;

  /**
   * Get activity events for a specific user
   * @param options - Query options
   */
  getUserActivity(options: UserActivityQueryOptions): Promise<ActivityEvent[]>;

  /**
   * Get session summaries for a user
   * @param userId - User ID
   * @param limit - Max sessions to return
   */
  getUserSessions(userId: string, limit?: number): Promise<SessionSummary[]>;

  /**
   * Get detailed activity for a specific session
   * @param userId - User ID
   * @param sessionId - Session ID
   */
  getSessionActivity(
    userId: string,
    sessionId: string
  ): Promise<ActivityEvent[]>;

  /**
   * Get presence stats (active/inactive counts, by module, etc.)
   */
  getPresenceStats(): Promise<{
    activeCount: number;
    inactiveCount: number;
    byModule: Record<string, number>;
    byDevice: Record<string, number>;
  }>;
}
