import { browser } from '$app/environment';
import type { IFavoritesManager } from './services/contracts/IFavoritesManager';
import { FavoritesManager } from './services/implementations/FavoritesManager';

let instance: IFavoritesManager | null = null;

export function getFavoritesManager(): IFavoritesManager {
	if (!browser) throw new Error('getFavoritesManager() is browser-only');
	return instance ??= new FavoritesManager();
}
