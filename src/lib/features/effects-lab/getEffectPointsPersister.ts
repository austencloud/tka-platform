import { browser } from '$app/environment';
import type { IEffectPointsPersister } from './services/contracts/IEffectPointsPersister';
import { EffectPointsPersister } from './services/implementations/EffectPointsPersister';

let instance: IEffectPointsPersister | null = null;

export function getEffectPointsPersister(): IEffectPointsPersister {
	if (!browser) throw new Error('getEffectPointsPersister() is browser-only');
	if (!instance) {
		instance = new EffectPointsPersister();
		instance.load();
	}
	return instance;
}
