import type { FirePhysicsParams } from "../../domain/types/FireTypes";
import type { PropTipConfig } from "../../domain/types/PropTipPoints";

/**
 * Loads admin-published fire defaults from Firestore.
 * Provides the baseline fire configuration for all users.
 * Uses localStorage as a write-through cache for offline resilience.
 */
export interface IFireDefaultsLoader {
	/** Load fire defaults from Firestore (or localStorage cache). Call once on app startup. */
	load(): Promise<void>;

	/** Whether defaults have been loaded (from Firestore or cache). */
	isLoaded(): boolean;

	/** Get admin-published fire points for a prop type. Returns null if no admin override. */
	getFirePoints(propType: string): PropTipConfig | null;

	/** Get all published fire point configs as a Record. */
	getAllFirePoints(): Record<string, PropTipConfig>;

	/** Get admin-published physics for a prop type. Falls back to global physics. */
	getPhysics(propType: string): FirePhysicsParams | null;

	/** Get the global physics baseline (admin's tuned default). Returns null if not published. */
	getGlobalPhysics(): FirePhysicsParams | null;

	/** Subscribe to real-time updates from Firestore. */
	subscribe(callback: () => void): void;

	/** Clean up Firestore listener. */
	dispose(): void;
}
