/**
 * Warning acknowledgement.
 *
 * Allows users to acknowledge moderation warnings, clearing the banner.
 */

import { doc, updateDoc } from 'firebase/firestore';
import { getFirestoreInstance } from '$lib/shared/auth/firebase';
import { authState } from '$lib/shared/auth/state/auth-state.svelte';

const USERS_COLLECTION = 'users';

/**
 * Acknowledge and clear the current user's active warning.
 */
export async function acknowledgeWarning(): Promise<void> {
	const userId = authState.user?.uid;
	if (!userId) {
		throw new Error('Must be logged in to acknowledge warning');
	}

	const firestore = await getFirestoreInstance();
	const userRef = doc(firestore, USERS_COLLECTION, userId);

	await updateDoc(userRef, {
		hasActiveWarning: false
	});
	// The WarningBanner's Firestore subscription will automatically update
}
