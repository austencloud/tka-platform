import type { PropFirePointConfig } from "$lib/shared/animation-engine/domain/types/PropFirePoints";

/**
 * Manages user-customized fire point configurations that override the
 * hardcoded defaults in PropFirePoints.ts. Persists to localStorage.
 */
export interface IFirePointOverrideProvider {
	/** Get custom fire points for a prop type, or null if using defaults. */
	getOverride(propType: string): PropFirePointConfig | null;

	/** Save a custom fire point configuration for a prop type. */
	saveOverride(propType: string, config: PropFirePointConfig): void;

	/** Remove the custom config for a prop type, reverting to defaults. */
	clearOverride(propType: string): void;

	/** Check if a prop type has a custom override. */
	hasOverride(propType: string): boolean;

	/** Get all prop types that have custom overrides. */
	getOverriddenTypes(): string[];

	/** Export all overrides as a JSON-serializable object. */
	exportAll(): Record<string, PropFirePointConfig>;

	/** Import overrides from a JSON object (merges with existing). */
	importAll(overrides: Record<string, PropFirePointConfig>): void;
}
