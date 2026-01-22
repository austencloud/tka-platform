/**
 * IAgeVerifier - Age verification for Hall of Shame access
 *
 * Manages user consent for viewing adult content.
 * Uses honor-system verification stored in user profile.
 */

export interface IAgeVerifier {
	/**
	 * Check if user has verified their age
	 * @param userId - The user's UID
	 * @returns true if user has previously verified 18+
	 */
	isVerified(userId: string): Promise<boolean>;

	/**
	 * Record age verification consent
	 * Stores timestamp in user profile for persistence
	 * @param userId - The user's UID
	 */
	recordVerification(userId: string): Promise<void>;

	/**
	 * Get verification timestamp
	 * @param userId - The user's UID
	 * @returns Date of verification, or null if not verified
	 */
	getVerificationDate(userId: string): Promise<Date | null>;
}
