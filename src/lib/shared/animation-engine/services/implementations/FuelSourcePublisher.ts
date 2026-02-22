/**
 * Fuel Source Publisher - Firestore Implementation
 *
 * Writes fuel source configurations to the Firestore collection
 * `config/fuelSources/{id}`. Admin-only: Firestore security rules
 * enforce isAdmin().
 *
 * Called from Flame Lab when an admin publishes tuned fuel parameters.
 * Refuses to delete built-in fuel sources.
 */

import {
	doc,
	setDoc,
	deleteDoc,
	serverTimestamp,
} from "firebase/firestore";
import { auth, getFirestoreInstance } from "$lib/shared/auth/firebase";
import { trackWrite } from "$lib/shared/offline/state/sync-status-state.svelte";
import type { FuelSourceDocument } from "../../domain/types/FuelSourceTypes";
import type { IFuelSourcePublisher } from "../contracts/IFuelSourcePublisher";

const FIRESTORE_COLLECTION_PATH = "config/fuelSources";

export class FuelSourcePublisher implements IFuelSourcePublisher {
	// ------------------------------------------------------------------
	// Firestore document reference for a specific fuel source
	// ------------------------------------------------------------------

	private async getDocRef(id: string) {
		const firestore = await getFirestoreInstance();
		return doc(firestore, FIRESTORE_COLLECTION_PATH, id);
	}

	// ------------------------------------------------------------------
	// publish()
	// ------------------------------------------------------------------

	async publish(fuelSource: FuelSourceDocument): Promise<void> {
		const uid = auth.currentUser?.uid;
		if (!uid) {
			throw new Error("Cannot publish fuel source: not authenticated");
		}

		const docRef = await this.getDocRef(fuelSource.id);

		await trackWrite(() =>
			setDoc(
				docRef,
				{
					...fuelSource,
					updatedAt: serverTimestamp(),
					updatedBy: uid,
				},
				{ merge: true }
			)
		);
	}

	// ------------------------------------------------------------------
	// publishAll()
	// ------------------------------------------------------------------

	async publishAll(fuelSources: FuelSourceDocument[]): Promise<void> {
		const uid = auth.currentUser?.uid;
		if (!uid) {
			throw new Error("Cannot publish fuel sources: not authenticated");
		}

		for (const fuelSource of fuelSources) {
			const docRef = await this.getDocRef(fuelSource.id);

			await trackWrite(() =>
				setDoc(
					docRef,
					{
						...fuelSource,
						updatedAt: serverTimestamp(),
						updatedBy: uid,
					},
					{ merge: true }
				)
			);
		}
	}

	// ------------------------------------------------------------------
	// delete()
	// ------------------------------------------------------------------

	async delete(id: string): Promise<void> {
		const uid = auth.currentUser?.uid;
		if (!uid) {
			throw new Error("Cannot delete fuel source: not authenticated");
		}

		// Refuse to delete built-in fuel sources
		const { BUILT_IN_FUEL_SOURCES } = await import(
			"../../domain/types/BuiltInFuelSources"
		);
		const isBuiltIn = BUILT_IN_FUEL_SOURCES.some((f) => f.id === id);
		if (isBuiltIn) {
			throw new Error(
				`Cannot delete built-in fuel source "${id}". Built-in fuels can be overridden but not removed.`
			);
		}

		const docRef = await this.getDocRef(id);
		await trackWrite(() => deleteDoc(docRef));
	}
}
