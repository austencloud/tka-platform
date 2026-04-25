import { browser } from '$app/environment';
import type { IFestivalLoader } from './services/contracts/IFestivalLoader';
import { FestivalLoader } from './services/implementations/FestivalLoader';

let instance: IFestivalLoader | null = null;

export function getFestivalLoader(): IFestivalLoader {
	if (!browser) throw new Error('getFestivalLoader() is browser-only');
	return instance ??= new FestivalLoader();
}
