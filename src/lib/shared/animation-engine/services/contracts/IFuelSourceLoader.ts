import type { FuelSourceDocument } from "../../domain/types/FuelSourceTypes";

/**
 * Loads fuel source configurations from Firestore, merging with
 * baked-in defaults. Uses localStorage as a write-through cache
 * for offline resilience.
 *
 * Firestore collection: config/fuelSources/{id}
 */
export interface IFuelSourceLoader {
	/** Load fuel sources from Firestore (or localStorage cache). Call once on app startup. */
	load(): Promise<void>;

	/** Get all fuel sources, sorted by sortOrder. */
	getAll(): FuelSourceDocument[];

	/** Get a specific fuel source by ID. */
	get(id: string): FuelSourceDocument | undefined;

	/** Subscribe to real-time updates from Firestore. */
	subscribe(callback: () => void): void;

	/** Clean up Firestore listener. */
	dispose(): void;
}
