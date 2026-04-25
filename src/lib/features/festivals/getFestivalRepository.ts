import { browser } from '$app/environment';
import type { IFestivalRepository } from './services/contracts/IFestivalRepository';
import { FestivalRepository } from './services/implementations/FestivalRepository';

let instance: IFestivalRepository | null = null;

export function getFestivalRepository(): IFestivalRepository {
	if (!browser) throw new Error('getFestivalRepository() is browser-only');
	return instance ??= new FestivalRepository();
}
