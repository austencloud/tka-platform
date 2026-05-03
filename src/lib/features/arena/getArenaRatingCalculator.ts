import { browser } from '$app/environment';
import { RatingCalculator } from './services/implementations/RatingCalculator';

let instance: RatingCalculator | null = null;

export function getArenaRatingCalculator(): RatingCalculator {
	if (!browser) throw new Error('getArenaRatingCalculator() is browser-only');
	return instance ??= new RatingCalculator();
}
