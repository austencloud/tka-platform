import { browser } from '$app/environment';

import { EffectPointsPersister } from './services/implementations/EffectPointsPersister';

let instance: EffectPointsPersister | null = null;

export function getEffectPointsPersister(): EffectPointsPersister {
	if (!browser) throw new Error('getEffectPointsPersister() is browser-only');
	if (!instance) {
		instance = new EffectPointsPersister();
		instance.load();
	}
	return instance;
}
