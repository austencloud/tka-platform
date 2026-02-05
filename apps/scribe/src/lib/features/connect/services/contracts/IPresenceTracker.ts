/**
 * IPresenceTracker
 *
 * Manages online/offline presence for the current user
 * and tracks presence of other users (friends, session participants).
 */

import type { UserPresence } from '../../domain/models/connect-models';

export interface IPresenceTracker {
	/** Whether presence tracking is active */
	readonly isTracking: boolean;

	/** Current user's ID */
	readonly currentUserId: string | null;

	/** Current user's presence state */
	readonly myPresence: UserPresence | null;

	/**
	 * Go online and start presence tracking.
	 * Sets up heartbeat and onDisconnect handler.
	 */
	goOnline(): Promise<void>;

	/**
	 * Go offline and stop presence tracking.
	 */
	goOffline(): Promise<void>;

	/**
	 * Update current session ID in presence.
	 * Lets others know you're in a session.
	 */
	setCurrentSession(sessionId: string | null): Promise<void>;

	/**
	 * Start watching a specific user's presence.
	 * Returns unsubscribe function.
	 */
	watchUser(userId: string): () => void;

	/**
	 * Stop watching a specific user's presence.
	 */
	unwatchUser(userId: string): void;

	/**
	 * Check if a user is currently online.
	 * Must be watching the user first.
	 */
	isUserOnline(userId: string): boolean;

	/**
	 * Get presence info for a watched user.
	 */
	getUserPresence(userId: string): UserPresence | null;

	/**
	 * Get all online user IDs from a list.
	 * Only returns users that are being watched.
	 */
	getOnlineUsers(userIds: string[]): string[];

	/**
	 * Watch multiple users at once.
	 * Returns unsubscribe function that stops all watchers.
	 */
	watchUsers(userIds: string[]): () => void;

	/**
	 * Subscribe to presence changes for any watched user.
	 * Callback receives userId and new online status.
	 */
	onPresenceChange(callback: (userId: string, presence: UserPresence) => void): () => void;

	/**
	 * Clean up all watchers and listeners.
	 */
	destroy(): void;
}
