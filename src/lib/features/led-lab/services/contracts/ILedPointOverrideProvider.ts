import type { PropLedConfig } from "$lib/shared/animation-engine/domain/types/LedTypes";

/**
 * Manages user-customized LED point configurations that override the
 * hardcoded defaults in PropLedPoints.ts. Persists to localStorage.
 *
 * Two layers of storage:
 * - **Working state**: the current LED point layout (auto-saved on every change)
 * - **User defaults**: a user-defined baseline per prop type ("Set as Default")
 */
export interface ILedPointOverrideProvider {
	/** Get custom LED points for a prop type, or null if using defaults. */
	getOverride(propType: string): PropLedConfig | null;

	/** Save a custom LED point configuration for a prop type. */
	saveOverride(propType: string, config: PropLedConfig): void;

	/** Remove the custom config for a prop type, reverting to defaults. */
	clearOverride(propType: string): void;

	/** Check if a prop type has a custom override. */
	hasOverride(propType: string): boolean;

	/** Get all prop types that have custom overrides. */
	getOverriddenTypes(): string[];

	/** Export all overrides as a JSON-serializable object. */
	exportAll(): Record<string, PropLedConfig>;

	/** Import overrides from a JSON object (merges with existing). */
	importAll(overrides: Record<string, PropLedConfig>): void;

	// --- Published defaults (admin-tuned, from Firestore) ---

	/** Load published LED point defaults from admin config. */
	loadPublishedDefaults(defaults: Record<string, PropLedConfig>): void;

	// --- User-defined defaults ---

	/** Save a user-defined default baseline for a prop type. */
	saveUserDefault(propType: string, config: PropLedConfig): void;

	/** Get the user-defined default for a prop type, or null if none set. */
	getUserDefault(propType: string): PropLedConfig | null;

	/** Check if a prop type has a user-defined default. */
	hasUserDefault(propType: string): boolean;

	/** Remove the user-defined default for a prop type. */
	clearUserDefault(propType: string): void;

	/** Get all prop types that have user-defined defaults. */
	getUserDefaultTypes(): string[];
}
