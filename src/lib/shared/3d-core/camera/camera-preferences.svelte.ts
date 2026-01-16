/**
 * Camera Preferences - Per-destination camera mode preferences
 *
 * Manages camera mode preferences with localStorage persistence.
 * Different destinations can have different default modes:
 * - Stage defaults to 3rd person (see formations)
 * - Gallery/Worlds default to 1st person (immersion)
 */

import { CameraMode } from "./types";

const STORAGE_KEY = "tka-camera-preferences";

interface CameraPreferencesData {
	globalDefault: CameraMode;
	destinationOverrides: Record<string, CameraMode>;
}

export function createCameraPreferences() {
	// Load from localStorage
	let data = $state<CameraPreferencesData>(loadFromStorage());

	/**
	 * Get camera mode for a specific destination
	 */
	function getModeForDestination(destinationId: string): CameraMode {
		return data.destinationOverrides[destinationId] ?? data.globalDefault;
	}

	/**
	 * Set camera mode for a specific destination
	 */
	function setModeForDestination(destinationId: string, mode: CameraMode): void {
		data.destinationOverrides[destinationId] = mode;
		saveToStorage();
	}

	/**
	 * Set global default camera mode
	 */
	function setGlobalDefault(mode: CameraMode): void {
		data.globalDefault = mode;
		saveToStorage();
	}

	/**
	 * Toggle camera mode for a destination
	 */
	function toggleMode(destinationId: string): CameraMode {
		const currentMode = getModeForDestination(destinationId);
		const newMode =
			currentMode === CameraMode.FIRST_PERSON
				? CameraMode.THIRD_PERSON
				: CameraMode.FIRST_PERSON;
		setModeForDestination(destinationId, newMode);
		return newMode;
	}

	/**
	 * Reset all preferences to defaults
	 */
	function reset(): void {
		data = {
			globalDefault: CameraMode.FIRST_PERSON,
			destinationOverrides: {},
		};
		saveToStorage();
	}

	/**
	 * Save current state to localStorage
	 */
	function saveToStorage(): void {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
		} catch (err) {
			console.warn("Failed to save camera preferences:", err);
		}
	}

	return {
		get globalDefault() {
			return data.globalDefault;
		},
		get destinationOverrides() {
			return data.destinationOverrides;
		},
		getModeForDestination,
		setModeForDestination,
		setGlobalDefault,
		toggleMode,
		reset,
	};
}

/**
 * Built-in defaults per destination (see docs/DESTINATIONS-VISION.md)
 * - Stage: 3rd person (director's view for choreography)
 * - Gallery/Worlds: 1st person (immersive exploration)
 */
const DESTINATION_DEFAULTS: Record<string, CameraMode> = {
	stage: CameraMode.THIRD_PERSON,
	// gallery and endless-world use globalDefault (first-person)
};

/**
 * Load preferences from localStorage
 */
function loadFromStorage(): CameraPreferencesData {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			const parsed = JSON.parse(stored) as CameraPreferencesData;
			// Validate structure
			if (
				parsed.globalDefault &&
				Object.values(CameraMode).includes(parsed.globalDefault)
			) {
				// Merge with built-in defaults (user overrides take precedence)
				return {
					globalDefault: parsed.globalDefault,
					destinationOverrides: {
						...DESTINATION_DEFAULTS,
						...parsed.destinationOverrides,
					},
				};
			}
		}
	} catch (err) {
		console.warn("Failed to load camera preferences:", err);
	}

	// Return defaults with built-in destination overrides
	return {
		globalDefault: CameraMode.FIRST_PERSON,
		destinationOverrides: { ...DESTINATION_DEFAULTS },
	};
}

/**
 * Singleton instance for global access
 */
export const cameraPreferences = createCameraPreferences();
