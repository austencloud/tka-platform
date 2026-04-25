import { browser } from '$app/environment';
import type { IAspectLayoutPlanner } from './services/contracts/IAspectLayoutPlanner';
import { AspectLayoutPlanner } from './services/implementations/AspectLayoutPlanner';

let instance: IAspectLayoutPlanner | null = null;

export function getAspectLayoutPlanner(): IAspectLayoutPlanner {
	if (!browser) throw new Error('getAspectLayoutPlanner() is browser-only');
	return instance ??= new AspectLayoutPlanner();
}
