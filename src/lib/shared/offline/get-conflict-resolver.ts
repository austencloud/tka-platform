import { browser } from '$app/environment';

import { ConflictResolver } from './services/conflict-resolver';

let instance: ConflictResolver | null = null;

export function getConflictResolver(): ConflictResolver {
	if (!browser) throw new Error('getConflictResolver() is browser-only');
	return instance ??= new ConflictResolver();
}
