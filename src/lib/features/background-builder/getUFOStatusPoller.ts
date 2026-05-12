import { browser } from '$app/environment';

import { UFOStatusPoller } from './services/UFOStatusPoller';

let instance: UFOStatusPoller | null = null;

export function getUFOStatusPoller(): UFOStatusPoller {
	if (!browser) throw new Error('getUFOStatusPoller() is browser-only');
	return instance ??= new UFOStatusPoller();
}
