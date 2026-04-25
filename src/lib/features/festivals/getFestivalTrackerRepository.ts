import { browser } from '$app/environment';
import type { IFestivalTrackerRepository } from './services/contracts/IFestivalTrackerRepository';
import { FestivalTrackerRepository } from './services/implementations/FestivalTrackerRepository';

let instance: IFestivalTrackerRepository | null = null;

export function getFestivalTrackerRepository(): IFestivalTrackerRepository {
	if (!browser) throw new Error('getFestivalTrackerRepository() is browser-only');
	return instance ??= new FestivalTrackerRepository();
}
