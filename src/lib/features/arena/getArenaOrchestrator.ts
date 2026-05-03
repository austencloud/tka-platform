import { browser } from '$app/environment';
import { ArenaOrchestrator } from './services/implementations/ArenaOrchestrator';
import { getArenaRepository } from './getArenaRepository';
import { getArenaRatingCalculator } from './getArenaRatingCalculator';
import { getArenaMatchupSelector } from './getArenaMatchupSelector';

let instance: ArenaOrchestrator | null = null;

export function getArenaOrchestrator(): ArenaOrchestrator {
	if (!browser) throw new Error('getArenaOrchestrator() is browser-only');
	return instance ??= new ArenaOrchestrator(
		getArenaRepository(),
		getArenaRatingCalculator(),
		getArenaMatchupSelector(),
	);
}
