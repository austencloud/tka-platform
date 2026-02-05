/**
 * Camera Preferences - Per-destination camera mode preferences
 *
 * Manages camera mode preferences with localStorage persistence.
 * Different destinations have different default modes:
 * - Stage: Orbit (director's view for choreography)
 * - Gallery: Third-person (see your avatar exploring)
 * - Worlds: First-person (immersive exploration)
 */

import { CameraMode, getNextCameraMode } from "./types";

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
	 * Cycle to next camera mode for a destination.
	 * Order: Orbit → Third Person → First Person → Orbit
	 */
	function cycleMode(destinationId: string): CameraMode {
		const currentMode = getModeForDestination(destinationId);
		const newMode = getNextCameraMode(currentMode);
		setModeForDestination(destinationId, newMode);
		return newMode;
	}

	/**
	 * @deprecated Use cycleMode instead for the full three-mode cycle
	 */
	function toggleMode(destinationId: string): CameraMode {
		return cycleMode(destinationId);
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
		cycleMode,
		toggleMode, // deprecated, use cycleMode
		reset,
	};
}

/**
 * Built-in defaults per destination
 * - Stage: Orbit (director's view for choreography, mouse-drag camera)
 * - Gallery: Third-person (see your avatar exploring the space)
 * - Worlds: First-person (immersive exploration)
 */
const DESTINATION_DEFAULTS: Record<string, CameraMode> = {
	stage: CameraMode.ORBIT,
	gallery: CameraMode.THIRD_PERSON,
	realm: CameraMode.ORBIT, // Start in orbit to show welcome overlay, click enters third-person
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
