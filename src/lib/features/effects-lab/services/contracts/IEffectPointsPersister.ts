/**
 * Shared effect point persistence.
 *
 * Stores full point data (position + effect-specific properties like flameScale)
 * in Firestore at `config/effectPoints`. All users read from this document so
 * admin edits propagate globally in real time.
 *
 * Firestore doc shape:
 *   config/effectPoints {
 *     staff: [{dx, dy, flameScale, ...}, ...],
 *     fan: [{dx, dy, flameScale, ...}, ...],
 *     updatedAt: Timestamp,
 *     updatedBy: uid
 *   }
 */

export interface EffectPoint {
	dx: number;
	dy: number;
	/** Additional effect-specific properties (e.g. flameScale, brightness) */
	[key: string]: number;
}

export interface IEffectPointsPersister {
	/** Load points from Firestore (falls back to localStorage cache). */
	load(): Promise<void>;

	/** Whether initial load has completed (Firestore or localStorage). */
	isLoaded(): boolean;

	/** Save points for a prop type. Writes localStorage immediately, Firestore debounced. */
	save(propType: string, points: EffectPoint[]): void;

	/** Get cached points for a prop type, or null if none stored. */
	getPoints(propType: string): EffectPoint[] | null;

	/** Subscribe to point changes (from Firestore onSnapshot). Returns unsubscribe fn. */
	subscribe(callback: () => void): () => void;

	/** Tear down Firestore listener and clear observers. */
	dispose(): void;
}
