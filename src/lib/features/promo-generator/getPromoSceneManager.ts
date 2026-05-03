import { browser } from '$app/environment';
import { PromoSceneManager } from './services/implementations/PromoSceneManager';

let instance: PromoSceneManager | null = null;

export function getPromoSceneManager(): PromoSceneManager {
	if (!browser) throw new Error('getPromoSceneManager() is browser-only');
	return instance ??= new PromoSceneManager();
}
