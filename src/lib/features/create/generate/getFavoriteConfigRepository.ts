import { browser } from '$app/environment';
import type { IFavoriteConfigRepository } from './services/contracts/IFavoriteConfigRepository';
import { FavoriteConfigRepository } from './services/implementations/FavoriteConfigRepository';

let instance: IFavoriteConfigRepository | null = null;

export function getFavoriteConfigRepository(): IFavoriteConfigRepository {
	if (!browser) throw new Error('getFavoriteConfigRepository() is browser-only');
	return instance ??= new FavoriteConfigRepository();
}
