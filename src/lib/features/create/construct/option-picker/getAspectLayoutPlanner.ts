import { browser } from '$app/environment';

import { AspectLayoutPlanner } from './services/implementations/AspectLayoutPlanner';

let instance: AspectLayoutPlanner | null = null;

export function getAspectLayoutPlanner(): AspectLayoutPlanner {
	if (!browser) throw new Error('getAspectLayoutPlanner() is browser-only');
	return instance ??= new AspectLayoutPlanner();
}
