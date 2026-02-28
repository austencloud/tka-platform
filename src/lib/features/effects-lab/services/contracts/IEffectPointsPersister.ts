/**
 * Shared effect point position persistence.
 *
 * Stores position-only data ({dx, dy}) in Firestore at `config/effectPoints`.
 * Each effect provider (fire, LED) enriches with its own intensity defaults
 * when serving data to renderers.
 *
 * Firestore doc shape:
 *   config/effectPoints {
 *     staff: [{dx, dy}, ...],
 *     fan: [{dx, dy}, ...],
 *     updatedAt: Timestamp,
 *     updatedBy: uid
 *   }
 */

export interface EffectPosition {
	dx: number;
	dy: number;
}

export interface IEffectPointsPersister {
	/** Load positions from Firestore (falls back to localStorage cache). */
	load(): Promise<void>;

	/** Save positions for a prop type. Writes localStorage immediately, Firestore debounced. */
	save(propType: string, points: EffectPosition[]): void;

	/** Get cached positions for a prop type, or null if none stored. */
	getPositions(propType: string): EffectPosition[] | null;

	/** Subscribe to position changes (from Firestore onSnapshot). Returns unsubscribe fn. */
	subscribe(callback: () => void): () => void;

	/** Tear down Firestore listener and clear observers. */
	dispose(): void;
}
