import { browser } from '$app/environment';
import { ArenaOrchestrator } from './services/ArenaOrchestrator';

let instance: ArenaOrchestrator | null = null;

export function getArenaOrchestrator(): ArenaOrchestrator {
	if (!browser) throw new Error('getArenaOrchestrator() is browser-only');
	return instance ??= new ArenaOrchestrator();
}
