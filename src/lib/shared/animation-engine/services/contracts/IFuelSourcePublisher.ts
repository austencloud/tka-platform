import type { FuelSourceDocument } from "../../domain/types/FuelSourceTypes";

/**
 * Publishes fuel source configurations to Firestore.
 * Admin-only: Firestore security rules enforce isAdmin().
 *
 * Firestore collection: config/fuelSources/{id}
 */
export interface IFuelSourcePublisher {
	/** Write a single fuel source document to Firestore. */
	publish(fuelSource: FuelSourceDocument): Promise<void>;

	/** Write all fuel source documents to Firestore. */
	publishAll(fuelSources: FuelSourceDocument[]): Promise<void>;

	/** Delete a custom fuel source. Throws if attempting to delete a built-in fuel. */
	delete(id: string): Promise<void>;
}
