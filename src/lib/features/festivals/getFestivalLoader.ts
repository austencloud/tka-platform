import { browser } from '$app/environment';

import { FestivalLoader } from './services/implementations/FestivalLoader';

let instance: FestivalLoader | null = null;

export function getFestivalLoader(): FestivalLoader {
	if (!browser) throw new Error('getFestivalLoader() is browser-only');
	return instance ??= new FestivalLoader();
}
