/**
 * User Sequence Presets - Type Definitions
 *
 * Presets capture the full configuration space for sequence generation:
 * LOOP type, slice size, constraints, turn intensity, level, and more.
 */

// Simple string types to avoid dependency on other modules
export type LoopType = "rewound" | "rotated";
export type SliceSize = "halved" | "quartered";
export type GridMode = "diamond" | "box" | "skewed";

/**
 * Configuration for sequence generation stored in a preset.
 * All fields are optional - unspecified fields use tool defaults.
 */
export interface PresetConfig {
	// LOOP settings
	loopType?: LoopType;
	sliceSize?: SliceSize;
	loopComponents?: Array<"rotated" | "mirrored" | "swapped" | "inverted">;

	// Word length (derived from LOOP config or explicit)
	wordLength?: number;

	// Difficulty
	level?: 1 | 2 | 3;
	turnIntensity?: number; // 0-3

	// Constraints
	constraintPreset?: string; // "smooth", "reversal", etc.
	constraints?: string; // Natural language override

	// Grid
	gridMode?: GridMode;

	// Visual (for image generation)
	darkMode?: boolean;
	cellSize?: number;
	layout?: "grid" | "strip";
}

/**
 * A saved user preset with metadata.
 */
export interface UserSequencePreset {
	id: string; // UUID
	name: string; // "Comfy 16"
	description?: string; // "My go-to comfortable sequence"
	icon?: string; // emoji

	config: PresetConfig;

	createdAt: number; // Unix timestamp
	updatedAt: number; // Unix timestamp
}

/**
 * The JSON file structure for persisted presets.
 */
export interface UserPresetsFile {
	version: 1;
	presets: UserSequencePreset[];
	lastModified: number; // Unix timestamp
}

/**
 * Input for creating a new preset.
 */
export interface CreatePresetInput {
	name: string;
	description?: string;
	icon?: string;

	// Flattened config fields for easier tool input
	loopType?: string;
	sliceSize?: string;
	loopComponents?: string[];
	wordLength?: number;
	level?: number;
	turnIntensity?: number;
	constraintPreset?: string;
	constraints?: string;
	gridMode?: string;
	darkMode?: boolean;
	cellSize?: number;
	layout?: string;
}

/**
 * Type guard to validate preset config values.
 */
export function isValidLoopType(value: string): value is LoopType {
	return ["rewound", "rotated"].includes(value);
}

export function isValidSliceSize(value: string): value is SliceSize {
	return ["halved", "quartered"].includes(value);
}

export function isValidGridMode(value: string): value is GridMode {
	return ["diamond", "box", "skewed"].includes(value);
}

export function isValidLevel(value: number): value is 1 | 2 | 3 {
	return [1, 2, 3].includes(value);
}

export function isValidLoopComponent(
	value: string
): value is "rotated" | "mirrored" | "swapped" | "inverted" {
	return ["rotated", "mirrored", "swapped", "inverted"].includes(value);
}

/**
 * Validates and normalizes raw input into a PresetConfig.
 * Returns null if validation fails.
 */
export function normalizePresetConfig(input: CreatePresetInput): PresetConfig | null {
	const config: PresetConfig = {};

	if (input.loopType !== undefined) {
		if (!isValidLoopType(input.loopType)) return null;
		config.loopType = input.loopType;
	}

	if (input.sliceSize !== undefined) {
		if (!isValidSliceSize(input.sliceSize)) return null;
		config.sliceSize = input.sliceSize;
	}

	if (input.loopComponents !== undefined) {
		if (!input.loopComponents.every(isValidLoopComponent)) return null;
		config.loopComponents = input.loopComponents as PresetConfig["loopComponents"];
	}

	if (input.wordLength !== undefined) {
		if (input.wordLength < 1 || input.wordLength > 20) return null;
		config.wordLength = input.wordLength;
	}

	if (input.level !== undefined) {
		if (!isValidLevel(input.level)) return null;
		config.level = input.level;
	}

	if (input.turnIntensity !== undefined) {
		if (input.turnIntensity < 0 || input.turnIntensity > 3) return null;
		config.turnIntensity = input.turnIntensity;
	}

	if (input.constraintPreset !== undefined) {
		config.constraintPreset = input.constraintPreset;
	}

	if (input.constraints !== undefined) {
		config.constraints = input.constraints;
	}

	if (input.gridMode !== undefined) {
		if (!isValidGridMode(input.gridMode)) return null;
		config.gridMode = input.gridMode;
	}

	if (input.darkMode !== undefined) {
		config.darkMode = input.darkMode;
	}

	if (input.cellSize !== undefined) {
		if (input.cellSize < 50 || input.cellSize > 500) return null;
		config.cellSize = input.cellSize;
	}

	if (input.layout !== undefined) {
		if (!["grid", "strip"].includes(input.layout)) return null;
		config.layout = input.layout as "grid" | "strip";
	}

	return config;
}
