/**
 * User Presets Module - Public Exports
 */

// Types
export type {
	UserSequencePreset,
	UserPresetsFile,
	PresetConfig,
	CreatePresetInput,
} from "./types.js";

export {
	isValidLoopType,
	isValidPeriod,
	isValidGridMode,
	isValidLevel,
	isValidLoopComponent,
	normalizePresetConfig,
} from "./types.js";

// Storage
export { getPresetsFilePath } from "./storage.js";

// Manager
export {
	createPreset,
	updatePreset,
	deletePreset,
	getPreset,
	listPresets,
	formatPresetSummary,
	seedDefaultPresets,
	PresetValidationError,
	PresetNotFoundError,
} from "./manager.js";
