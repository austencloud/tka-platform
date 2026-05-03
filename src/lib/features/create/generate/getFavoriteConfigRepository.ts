import { browser } from '$app/environment';
import { FavoriteConfigRepository } from './services/implementations/FavoriteConfigRepository';

let instance: FavoriteConfigRepository | null = null;

export function getFavoriteConfigRepository(): FavoriteConfigRepository {
	if (!browser) throw new Error('getFavoriteConfigRepository() is browser-only');
	return instance ??= new FavoriteConfigRepository();
}
