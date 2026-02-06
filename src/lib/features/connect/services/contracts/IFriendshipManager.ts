/**
 * IFriendshipManager
 *
 * Manages the user's friend list (follow model, not mutual).
 * Friends can be invited to sessions and show online status.
 */

import type { Friend, UserSearchResult } from '../../domain/models/connect-models';

export interface IFriendshipManager {
	/** Current user's friends */
	readonly friends: Friend[];

	/** Number of friends */
	readonly friendCount: number;

	/** Whether friends have been loaded */
	readonly isLoaded: boolean;

	/**
	 * Add a user to friends list.
	 * @param userId - Firebase UID of user to add
	 * @param displayName - Their display name (cached for offline)
	 */
	addFriend(userId: string, displayName: string): Promise<void>;

	/**
	 * Remove a user from friends list.
	 */
	removeFriend(userId: string): Promise<void>;

	/**
	 * Check if a user is a friend.
	 */
	isFriend(userId: string): boolean;

	/**
	 * Get a specific friend by ID.
	 */
	getFriend(userId: string): Friend | null;

	/**
	 * Update a friend's nickname.
	 */
	setNickname(userId: string, nickname: string | null): Promise<void>;

	/**
	 * Search for users by username/display name.
	 * @param query - Search string (min 2 chars)
	 * @returns Matching users with online/friend status
	 */
	searchUsers(query: string): Promise<UserSearchResult[]>;

	/**
	 * Get a user's profile by ID.
	 * Used when you have a userId but need display name.
	 */
	getUserProfile(userId: string): Promise<{ displayName: string; photoURL?: string } | null>;

	/**
	 * Subscribe to friend list changes.
	 */
	onFriendsChange(callback: (friends: Friend[]) => void): () => void;

	/**
	 * Load friends from Firebase.
	 * Called on initialization.
	 */
	loadFriends(): Promise<void>;

	/**
	 * Clean up listeners.
	 */
	destroy(): void;
}
