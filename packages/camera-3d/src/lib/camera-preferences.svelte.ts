import { CameraMode, getNextCameraMode } from "./types";

const STORAGE_KEY = "camera-3d-preferences";

interface CameraPreferencesData {
	globalDefault: CameraMode;
	destinationOverrides: Record<string, CameraMode>;
}

export type CameraPreferences = ReturnType<typeof createCameraPreferences>;

export function createCameraPreferences(
	storageKey = STORAGE_KEY,
	defaults: Record<string, CameraMode> = {},
) {
	let data = $state<CameraPreferencesData>(loadFromStorage(storageKey, defaults));

	function getModeForDestination(destinationId: string): CameraMode {
		return data.destinationOverrides[destinationId] ?? data.globalDefault;
	}

	function setModeForDestination(destinationId: string, mode: CameraMode): void {
		data.destinationOverrides[destinationId] = mode;
		saveToStorage();
	}

	function setGlobalDefault(mode: CameraMode): void {
		data.globalDefault = mode;
		saveToStorage();
	}

	function cycleMode(destinationId: string): CameraMode {
		const currentMode = getModeForDestination(destinationId);
		const newMode = getNextCameraMode(currentMode);
		setModeForDestination(destinationId, newMode);
		return newMode;
	}

	function reset(): void {
		data = {
			globalDefault: CameraMode.FIRST_PERSON,
			destinationOverrides: { ...defaults },
		};
		saveToStorage();
	}

	function saveToStorage(): void {
		try {
			localStorage.setItem(storageKey, JSON.stringify(data));
		} catch {
			// localStorage unavailable (SSR, private browsing, etc.)
		}
	}

	return {
		get globalDefault() { return data.globalDefault; },
		get destinationOverrides() { return data.destinationOverrides; },
		getModeForDestination,
		setModeForDestination,
		setGlobalDefault,
		cycleMode,
		reset,
	};
}

function loadFromStorage(
	storageKey: string,
	defaults: Record<string, CameraMode>,
): CameraPreferencesData {
	try {
		const stored = localStorage.getItem(storageKey);
		if (stored) {
			const parsed = JSON.parse(stored) as CameraPreferencesData;
			if (parsed.globalDefault && Object.values(CameraMode).includes(parsed.globalDefault)) {
				return {
					globalDefault: parsed.globalDefault,
					destinationOverrides: { ...defaults, ...parsed.destinationOverrides },
				};
			}
		}
	} catch {
		// localStorage unavailable
	}
	return {
		globalDefault: CameraMode.FIRST_PERSON,
		destinationOverrides: { ...defaults },
	};
}
