import { browser } from '$app/environment';
import type { ICoralAssetLoader } from './services/contracts/ICoralAssetLoader';
import { CoralAssetLoader } from './services/implementations/CoralAssetLoader';

let instance: ICoralAssetLoader | null = null;

export function getCoralAssetLoader(): ICoralAssetLoader {
	if (!browser) throw new Error('getCoralAssetLoader() is browser-only');
	return instance ??= new CoralAssetLoader();
}
