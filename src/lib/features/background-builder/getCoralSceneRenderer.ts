import { browser } from '$app/environment';
import type { ICoralSceneRenderer } from './services/contracts/ICoralSceneRenderer';
import { CoralSceneRenderer } from './services/implementations/CoralSceneRenderer';
import { getCoralAssetLoader } from './getCoralAssetLoader';

let instance: ICoralSceneRenderer | null = null;

export function getCoralSceneRenderer(): ICoralSceneRenderer {
	if (!browser) throw new Error('getCoralSceneRenderer() is browser-only');
	return instance ??= new CoralSceneRenderer(getCoralAssetLoader());
}
