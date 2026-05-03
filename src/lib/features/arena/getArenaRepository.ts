import { browser } from '$app/environment';
import { ArenaRepository } from './services/implementations/ArenaRepository';

let instance: ArenaRepository | null = null;

export function getArenaRepository(): ArenaRepository {
	if (!browser) throw new Error('getArenaRepository() is browser-only');
	return instance ??= new ArenaRepository();
}
