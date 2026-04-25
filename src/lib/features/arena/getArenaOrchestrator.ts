import { browser } from '$app/environment';
import type { IArenaOrchestrator } from './services/contracts/IArenaOrchestrator';
import { ArenaOrchestrator } from './services/implementations/ArenaOrchestrator';
import { getArenaRepository } from './getArenaRepository';
import { getArenaRatingCalculator } from './getArenaRatingCalculator';
import { getArenaMatchupSelector } from './getArenaMatchupSelector';

let instance: IArenaOrchestrator | null = null;

export function getArenaOrchestrator(): IArenaOrchestrator {
	if (!browser) throw new Error('getArenaOrchestrator() is browser-only');
	return instance ??= new ArenaOrchestrator(
		getArenaRepository(),
		getArenaRatingCalculator(),
		getArenaMatchupSelector(),
	);
}
