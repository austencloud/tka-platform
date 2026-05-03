import { browser } from '$app/environment';
import { FestivalRepository } from './services/implementations/FestivalRepository';

let instance: FestivalRepository | null = null;

export function getFestivalRepository(): FestivalRepository {
	if (!browser) throw new Error('getFestivalRepository() is browser-only');
	return instance ??= new FestivalRepository();
}
