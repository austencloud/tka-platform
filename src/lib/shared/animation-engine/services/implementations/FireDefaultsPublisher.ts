/**
 * Fire Defaults Publisher - Firestore Implementation
 *
 * Writes admin-tuned fire defaults to Firestore at `config/fireDefaults`.
 * Admin-only: Firestore security rules enforce isAdmin().
 *
 * Called from Flame Lab's "Publish to Production" flow after the admin
 * finishes tuning fire points and physics.
 */

import {
	doc,
	setDoc,
	serverTimestamp,
} from "firebase/firestore";
import { auth, getFirestoreInstance } from "$lib/shared/auth/firebase";
import { trackWrite } from "$lib/shared/offline/state/sync-status-state.svelte";
import type { FirePhysicsParams } from "../../domain/types/FireTypes";
import type { PropTipConfig } from "../../domain/types/PropTipPoints";
const FIRESTORE_DOC_PATH = "config/fireDefaults";

export class FireDefaultsPublisher {
	// ------------------------------------------------------------------
	// Firestore document reference
	// ------------------------------------------------------------------

	private async getDocRef() {
		const firestore = await getFirestoreInstance();
		return doc(firestore, FIRESTORE_DOC_PATH);
	}

	// ------------------------------------------------------------------
	// publish()
	// ------------------------------------------------------------------

	async publish(data: {
		firePoints: Record<string, PropTipConfig>;
		propPhysics: Record<string, FirePhysicsParams>;
		globalPhysics: FirePhysicsParams;
	}): Promise<void> {
		const uid = auth.currentUser?.uid;
		if (!uid) {
			throw new Error("Cannot publish fire defaults: not authenticated");
		}

		const docRef = await this.getDocRef();

		await trackWrite(() =>
			setDoc(
				docRef,
				{
					firePoints: data.firePoints,
					propPhysics: data.propPhysics,
					globalPhysics: data.globalPhysics,
					updatedAt: serverTimestamp(),
					updatedBy: uid,
				},
				{ merge: true }
			)
		);
	}
}
