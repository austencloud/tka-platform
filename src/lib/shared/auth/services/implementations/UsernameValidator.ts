/**
 * UsernameValidator
 *
 * Enforces unique usernames with case-insensitive checking.
 * Uses Firestore transactions to prevent race conditions when claiming usernames.
 */

import {
	doc,
	getDoc,
	runTransaction,
	serverTimestamp,
	deleteDoc
} from 'firebase/firestore';
import { getFirestoreInstance } from '../../firebase';
import type { UsernameValidationResult } from '../../domain/models/UsernameValidation';
import { validateUsernameFormat, formatUsername } from '../../domain/models/UsernameValidation';

export class UsernameValidator {
	private readonly USERNAMES_COLLECTION = 'usernames';
	private readonly USERS_COLLECTION = 'users';

	validateFormat(username: string): UsernameValidationResult {
		return validateUsernameFormat(username);
	}

	async checkAvailability(
		username: string,
		excludeUserId?: string
	): Promise<UsernameValidationResult> {
		// First check format
		const formatResult = this.validateFormat(username);
		if (!formatResult.isValid) {
			return formatResult;
		}

		// Check Firestore for uniqueness
		try {
			const firestore = await getFirestoreInstance();
			const usernameLowercase = formatUsername(username);
			const usernameDocRef = doc(firestore, this.USERNAMES_COLLECTION, usernameLowercase);
			const usernameDoc = await getDoc(usernameDocRef);

			if (usernameDoc.exists()) {
				const ownerId = usernameDoc.data().userId;

				// Allow if checking own username
				if (excludeUserId && ownerId === excludeUserId) {
					return { isValid: true };
				}

				// Username is taken - generate suggestions
				const suggestions = await this.generateSuggestions(username);
				return {
					isValid: false,
					error: 'Username is already taken',
					suggestions
				};
			}

			return { isValid: true };
		} catch (error) {
			console.error('[UsernameValidator] Availability check failed:', error);
			return {
				isValid: false,
				error: 'Unable to check availability. Please try again.'
			};
		}
	}

	async generateUniqueUsername(base: string): Promise<string> {
		// Clean base: lowercase, remove invalid chars, take first 15 chars to leave room for suffix
		let cleanBase = base
			.toLowerCase()
			.replace(/[^a-z0-9_-]/g, '')
			.substring(0, 15);

		// Ensure minimum length
		if (cleanBase.length < 3) {
			cleanBase = 'user';
		}

		// Remove leading/trailing special chars
		cleanBase = cleanBase.replace(/^[-_]+|[-_]+$/g, '');

		// Try base first
		const baseResult = await this.checkAvailability(cleanBase);
		if (baseResult.isValid) {
			return cleanBase;
		}

		// Try base + random 3-digit suffix (max 10 attempts)
		for (let i = 0; i < 10; i++) {
			const suffix = Math.floor(100 + Math.random() * 900); // 100-999
			const candidate = `${cleanBase}_${suffix}`;
			const result = await this.checkAvailability(candidate);
			if (result.isValid) {
				return candidate;
			}
		}

		// Fallback: timestamp-based (extremely unlikely to be needed)
		return `${cleanBase}_${Date.now().toString().slice(-6)}`;
	}

	async claimUsername(userId: string, username: string): Promise<void> {
		// Validate format first
		const formatResult = this.validateFormat(username);
		if (!formatResult.isValid) {
			throw new Error(formatResult.error || 'Invalid username format');
		}

		const firestore = await getFirestoreInstance();
		const usernameLowercase = formatUsername(username);

		await runTransaction(firestore, async (transaction) => {
			// Check availability within transaction
			const usernameDocRef = doc(firestore, this.USERNAMES_COLLECTION, usernameLowercase);
			const usernameDoc = await transaction.get(usernameDocRef);

			if (usernameDoc.exists() && usernameDoc.data().userId !== userId) {
				throw new Error('Username is already taken');
			}

			// Claim username in /usernames collection
			transaction.set(usernameDocRef, {
				userId,
				createdAt: serverTimestamp(),
				updatedAt: serverTimestamp()
			});

			// Update user document with username
			const userDocRef = doc(firestore, this.USERS_COLLECTION, userId);
			transaction.update(userDocRef, {
				username,
				usernameLowercase,
				updatedAt: serverTimestamp()
			});
		});
	}

	async releaseUsername(username: string): Promise<void> {
		try {
			const firestore = await getFirestoreInstance();
			const usernameLowercase = formatUsername(username);
			const usernameDocRef = doc(firestore, this.USERNAMES_COLLECTION, usernameLowercase);

			await deleteDoc(usernameDocRef);
		} catch (error) {
			console.error('[UsernameValidator] Failed to release username:', error);
			// Don't throw - this is cleanup, not critical path
		}
	}

	/**
	 * Generate alternative username suggestions when requested one is taken
	 */
	private async generateSuggestions(base: string): Promise<string[]> {
		const suggestions: string[] = [];
		const cleanBase = base
			.toLowerCase()
			.replace(/[^a-z0-9]/g, '')
			.substring(0, 17); // Leave room for 2-digit suffix

		// Generate 3 random suggestions
		const usedSuffixes = new Set<number>();
		while (suggestions.length < 3 && usedSuffixes.size < 90) {
			const suffix = Math.floor(10 + Math.random() * 90); // 10-99
			if (usedSuffixes.has(suffix)) continue;
			usedSuffixes.add(suffix);

			const candidate = `${cleanBase}${suffix}`;
			const result = await this.checkAvailability(candidate);
			if (result.isValid) {
				suggestions.push(candidate);
			}
		}

		return suggestions;
	}
}
