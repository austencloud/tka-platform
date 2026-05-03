import { browser } from '$app/environment';
import { FestivalTrackerRepository } from './services/implementations/FestivalTrackerRepository';

let instance: FestivalTrackerRepository | null = null;

export function getFestivalTrackerRepository(): FestivalTrackerRepository {
	if (!browser) throw new Error('getFestivalTrackerRepository() is browser-only');
	return instance ??= new FestivalTrackerRepository();
}
