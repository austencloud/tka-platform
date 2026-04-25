import { browser } from '$app/environment';
import type { IMatchupSelector } from './services/contracts/IMatchupSelector';
import { MatchupSelector } from './services/implementations/MatchupSelector';

let instance: IMatchupSelector | null = null;

export function getArenaMatchupSelector(): IMatchupSelector {
	if (!browser) throw new Error('getArenaMatchupSelector() is browser-only');
	return instance ??= new MatchupSelector();
}
