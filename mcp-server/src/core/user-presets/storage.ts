/**
 * User Presets Storage - File Operations
 *
 * Handles reading/writing the user-presets.json file with atomic writes.
 */

import * as fs from "fs";
import * as path from "path";
import type { UserPresetsFile, UserSequencePreset } from "./types.js";

// Resolve data directory relative to the mcp-server package
const DATA_DIR = path.resolve(import.meta.dirname, "../../../data");
const PRESETS_FILE = path.join(DATA_DIR, "user-presets.json");

/**
 * Default presets file structure when no file exists.
 */
function createEmptyPresetsFile(): UserPresetsFile {
	return {
		version: 1,
		presets: [],
		lastModified: Date.now(),
	};
}

/**
 * Loads user presets from the JSON file.
 * Returns empty structure if file doesn't exist.
 */
export function loadUserPresets(): UserPresetsFile {
	try {
		if (!fs.existsSync(PRESETS_FILE)) {
			return createEmptyPresetsFile();
		}

		const content = fs.readFileSync(PRESETS_FILE, "utf-8");
		const data = JSON.parse(content) as UserPresetsFile;

		if (data.version !== 1 || !Array.isArray(data.presets)) {
			console.warn("Invalid presets file structure, returning empty");
			return createEmptyPresetsFile();
		}

		return data;
	} catch (error) {
		console.error("Error loading user presets:", error);
		return createEmptyPresetsFile();
	}
}

/**
 * Saves user presets to the JSON file using atomic write.
 * Writes to a temp file first, then renames to prevent corruption.
 */
export function saveUserPresets(data: UserPresetsFile): void {
	// Ensure data directory exists
	if (!fs.existsSync(DATA_DIR)) {
		fs.mkdirSync(DATA_DIR, { recursive: true });
	}

	// Update timestamp
	data.lastModified = Date.now();

	// Write to temp file first
	const tempFile = PRESETS_FILE + ".tmp";
	const content = JSON.stringify(data, null, 2);

	fs.writeFileSync(tempFile, content, "utf-8");

	// Atomic rename
	fs.renameSync(tempFile, PRESETS_FILE);
}

/**
 * Adds a preset to storage.
 */
export function addPreset(preset: UserSequencePreset): void {
	const data = loadUserPresets();
	data.presets.push(preset);
	saveUserPresets(data);
}

/**
 * Updates a preset by ID.
 */
export function updatePreset(
	id: string,
	updates: Partial<Omit<UserSequencePreset, "id" | "createdAt">>
): UserSequencePreset | null {
	const data = loadUserPresets();
	const index = data.presets.findIndex((p) => p.id === id);

	if (index === -1) {
		return null;
	}

	const existing = data.presets[index];
	const updated: UserSequencePreset = {
		...existing,
		...updates,
		config: updates.config ? { ...existing.config, ...updates.config } : existing.config,
		updatedAt: Date.now(),
	};

	data.presets[index] = updated;
	saveUserPresets(data);

	return updated;
}

/**
 * Deletes a preset by ID.
 */
export function deletePreset(id: string): boolean {
	const data = loadUserPresets();
	const index = data.presets.findIndex((p) => p.id === id);

	if (index === -1) {
		return false;
	}

	data.presets.splice(index, 1);
	saveUserPresets(data);

	return true;
}

/**
 * Gets a preset by ID or name.
 */
export function getPreset(idOrName: string): UserSequencePreset | null {
	const data = loadUserPresets();

	// Try ID first
	let preset = data.presets.find((p) => p.id === idOrName);
	if (preset) return preset;

	// Try name (case-insensitive)
	preset = data.presets.find((p) => p.name.toLowerCase() === idOrName.toLowerCase());
	return preset || null;
}

/**
 * Lists all presets.
 */
export function listPresets(): UserSequencePreset[] {
	return loadUserPresets().presets;
}

/**
 * Gets the file path for diagnostics.
 */
export function getPresetsFilePath(): string {
	return PRESETS_FILE;
}
