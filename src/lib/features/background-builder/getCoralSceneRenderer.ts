import { browser } from '$app/environment';
import { CoralSceneRenderer } from './services/implementations/CoralSceneRenderer';
import { getCoralAssetLoader } from './getCoralAssetLoader';

let instance: CoralSceneRenderer | null = null;

export function getCoralSceneRenderer(): CoralSceneRenderer {
	if (!browser) throw new Error('getCoralSceneRenderer() is browser-only');
	return instance ??= new CoralSceneRenderer(getCoralAssetLoader());
}
