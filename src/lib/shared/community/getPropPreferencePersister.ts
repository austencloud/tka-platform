import { browser } from '$app/environment';
import type { IPropPreferencePersister } from './services/contracts/IPropPreferencePersister';
import { PropPreferencePersister } from './services/implementations/PropPreferencePersister';

let instance: IPropPreferencePersister | null = null;

export function getPropPreferencePersister(): IPropPreferencePersister {
	if (!browser) throw new Error('getPropPreferencePersister() is browser-only');
	return instance ??= new PropPreferencePersister();
}
