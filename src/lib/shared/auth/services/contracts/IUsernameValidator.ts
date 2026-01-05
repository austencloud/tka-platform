/**
 * IUsernameValidator
 *
 * Validates username format and checks uniqueness across the platform.
 * Uses Firestore transactions to ensure atomic username claims.
 */

import type { UsernameValidationResult } from '../../domain/models/UsernameValidation';

export interface IUsernameValidator {
	/**
	 * Validate username format (synchronous)
	 * Checks length, allowed characters, and reserved names
	 */
	validateFormat(username: string): UsernameValidationResult;

	/**
	 * Check if username is available (queries Firestore)
	 * @param username - Username to check
	 * @param excludeUserId - Optional user ID to exclude (for self-edit scenarios)
	 * @returns Validation result with availability status and suggestions if taken
	 */
	checkAvailability(username: string, excludeUserId?: string): Promise<UsernameValidationResult>;

	/**
	 * Generate a unique username from a base string
	 * Appends random suffix if base is already taken
	 * @param base - Base username (e.g., email prefix)
	 * @returns Unique username that is guaranteed available
	 */
	generateUniqueUsername(base: string): Promise<string>;

	/**
	 * Claim a username for a user (transactional)
	 * Updates both /usernames collection and /users document atomically
	 * @throws Error if username is already taken
	 */
	claimUsername(userId: string, username: string): Promise<void>;

	/**
	 * Release a username when user changes to a different one
	 * Removes entry from /usernames collection
	 */
	releaseUsername(username: string): Promise<void>;
}
