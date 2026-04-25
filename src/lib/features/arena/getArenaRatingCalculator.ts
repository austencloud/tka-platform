import { browser } from '$app/environment';
import type { IRatingCalculator } from './services/contracts/IRatingCalculator';
import { RatingCalculator } from './services/implementations/RatingCalculator';

let instance: IRatingCalculator | null = null;

export function getArenaRatingCalculator(): IRatingCalculator {
	if (!browser) throw new Error('getArenaRatingCalculator() is browser-only');
	return instance ??= new RatingCalculator();
}
