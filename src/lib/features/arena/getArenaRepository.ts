import { browser } from '$app/environment';
import type { IArenaRepository } from './services/contracts/IArenaRepository';
import { ArenaRepository } from './services/implementations/ArenaRepository';

let instance: IArenaRepository | null = null;

export function getArenaRepository(): IArenaRepository {
	if (!browser) throw new Error('getArenaRepository() is browser-only');
	return instance ??= new ArenaRepository();
}
