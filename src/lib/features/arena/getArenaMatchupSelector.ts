import { browser } from '$app/environment';

import { MatchupSelector } from './services/implementations/MatchupSelector';

let instance: MatchupSelector | null = null;

export function getArenaMatchupSelector(): MatchupSelector {
	if (!browser) throw new Error('getArenaMatchupSelector() is browser-only');
	return instance ??= new MatchupSelector();
}
