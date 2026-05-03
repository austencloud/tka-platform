import { browser } from '$app/environment';
import { TriGridPositionResolver } from './services/implementations/TriGridPositionResolver';

let instance: TriGridPositionResolver | null = null;

export function getTriGridPositionResolver(): TriGridPositionResolver {
	if (!browser) throw new Error('getTriGridPositionResolver() is browser-only');
	return instance ??= new TriGridPositionResolver();
}
