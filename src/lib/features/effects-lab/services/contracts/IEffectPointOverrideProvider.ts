/**
 * Unified interface for effect point override storage.
 * Used by both FirePointOverrideProvider and LedPointOverrideProvider.
 *
 * Two-layer storage model:
 * - Working state: auto-saved on every edit in the Effects Lab editor
 * - User defaults: baseline per prop type ("Set as Default" action)
 * Plus admin-published defaults loaded from Firestore (fire only, currently).
 */
export interface IEffectPointOverrideProvider {
	/** Get custom effect points for a prop type, or null if using defaults. */
	getOverride(propType: string): any | null;

	/** Save a custom effect point configuration for a prop type. */
	saveOverride(propType: string, config: any): void;

	/** Remove the custom config for a prop type, reverting to defaults. */
	clearOverride(propType: string): void;

	/** Check if a prop type has a custom override. */
	hasOverride(propType: string): boolean;

	/** Get all prop types that have custom overrides. */
	getOverriddenTypes(): string[];

	/** Export all overrides as a JSON-serializable object. */
	exportAll(): Record<string, any>;

	/** Import overrides from a JSON object (merges with existing). */
	importAll(overrides: Record<string, any>): void;

	// --- Published defaults (admin-tuned, from Firestore) ---

	/** Load published effect point defaults from admin config. */
	loadPublishedDefaults(defaults: Record<string, any>): void;

	// --- User-defined defaults ---

	/** Save a user-defined default baseline for a prop type. */
	saveUserDefault(propType: string, config: any): void;

	/** Get the user-defined default for a prop type, or null if none set. */
	getUserDefault(propType: string): any | null;

	/** Check if a prop type has a user-defined default. */
	hasUserDefault(propType: string): boolean;

	/** Remove the user-defined default for a prop type. */
	clearUserDefault(propType: string): void;

	/** Get all prop types that have user-defined defaults. */
	getUserDefaultTypes(): string[];
}
