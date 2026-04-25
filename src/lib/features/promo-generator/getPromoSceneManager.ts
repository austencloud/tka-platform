import { browser } from '$app/environment';
import type { IPromoSceneManager } from './services/contracts/IPromoSceneManager';
import { PromoSceneManager } from './services/implementations/PromoSceneManager';

let instance: IPromoSceneManager | null = null;

export function getPromoSceneManager(): IPromoSceneManager {
	if (!browser) throw new Error('getPromoSceneManager() is browser-only');
	return instance ??= new PromoSceneManager();
}
