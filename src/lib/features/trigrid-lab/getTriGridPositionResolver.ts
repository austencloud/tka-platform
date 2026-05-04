import { browser } from '$app/environment';
import * as triGridPositionResolver from './services/trigrid-position-resolver';

export function getTriGridPositionResolver(): typeof triGridPositionResolver {
	if (!browser) throw new Error('getTriGridPositionResolver() is browser-only');
	return triGridPositionResolver;
}
