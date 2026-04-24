import { browser } from '$app/environment';
import type { IConflictResolver } from './services/contracts/IConflictResolver';
import { ConflictResolver } from './services/implementations/ConflictResolver';

let instance: IConflictResolver | null = null;

export function getConflictResolver(): IConflictResolver {
	if (!browser) throw new Error('getConflictResolver() is browser-only');
	return instance ??= new ConflictResolver();
}
