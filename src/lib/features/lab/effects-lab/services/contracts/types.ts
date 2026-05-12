
// --- From IEffectPointsPersister ---
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


export interface EffectPoint {
	dx: number;
	dy: number;
	/** Additional effect-specific properties (e.g. flameScale, brightness) */
	[key: string]: number;
}

