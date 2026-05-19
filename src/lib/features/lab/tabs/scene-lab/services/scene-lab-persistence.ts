import type { SceneId } from "../domain/scene-lab-types";
import type {
	WinterSceneConfig,
	ForestSceneConfig,
	AutumnSceneConfig,
	CosmicSceneConfig,
	OceanSceneConfig,
} from "$lib/shared/3d/environments/domain/models/scene-configs";

const STORAGE_KEY = "scene-lab-state";
const CURRENT_VERSION = 1;

export interface PersistedSceneLabConfigs {
	winter: WinterSceneConfig;
	forestFirefly: ForestSceneConfig;
	forestAutumn: AutumnSceneConfig;
	cosmicNight: CosmicSceneConfig;
	cosmicAurora: CosmicSceneConfig;
	oceanDeep: OceanSceneConfig;
	oceanReef: OceanSceneConfig;
}

export interface PersistedSceneLabState {
	version: number;
	sceneId: SceneId;
	configs: PersistedSceneLabConfigs;
}

export function saveSceneLabState(data: PersistedSceneLabState): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
	} catch (e) {
		console.warn("Failed to save scene lab state:", e);
	}
}

export function loadSceneLabState(): PersistedSceneLabState | null {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		const data = JSON.parse(raw) as PersistedSceneLabState;
		if (data.version !== CURRENT_VERSION) return null;
		return data;
	} catch {
		return null;
	}
}

export function clearSceneLabState(): void {
	try {
		localStorage.removeItem(STORAGE_KEY);
	} catch {
		// noop
	}
}
