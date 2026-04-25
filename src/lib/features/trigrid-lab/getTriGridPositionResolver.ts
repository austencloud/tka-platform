import { browser } from '$app/environment';
import type { ITriGridPositionResolver } from './services/contracts/ITriGridPositionResolver';
import { TriGridPositionResolver } from './services/implementations/TriGridPositionResolver';

let instance: ITriGridPositionResolver | null = null;

export function getTriGridPositionResolver(): ITriGridPositionResolver {
	if (!browser) throw new Error('getTriGridPositionResolver() is browser-only');
	return instance ??= new TriGridPositionResolver();
}
