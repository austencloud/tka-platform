/**
 * Shared effect point persistence.
 *
 * Stores position-only tip point data ({ dx, dy }) in Firestore at
 * `config/effectPoints`. All users read from the same document so admin
 * edits propagate globally in real time. Effect-specific properties
 * (flameScale, brightness, etc.) are applied by each renderer at read time
 * and are NOT stored here.
 *
 * Firestore doc shape:
 *   config/effectPoints {
 *     staff: [{dx, dy}, ...],
 *     fan: [{dx, dy}, ...],
 *     updatedAt: Timestamp,
 *     updatedBy: uid
 *   }
 */

import type { TrailPointConfig } from "$lib/shared/animation-engine/domain/types/TrailPointTypes";

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

	// --- Trail assignments ---

	/** Save trail point assignments for a prop type. localStorage immediate, Firestore debounced. */
	saveTrailAssignment(propType: string, config: TrailPointConfig): void;

	/** Get cached trail assignment for a prop type, or null if none stored. */
	getTrailAssignment(propType: string): TrailPointConfig | null;

	/** Get all prop types that have trail assignments. */
	getTrailAssignmentTypes(): string[];

	/** Remove trail assignment for a prop type, reverting to geometric fallback. */
	removeTrailAssignment(propType: string): void;
}
