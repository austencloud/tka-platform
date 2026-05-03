import { browser } from '$app/environment';
import { PropPreferencePersister } from './services/implementations/PropPreferencePersister';

let instance: PropPreferencePersister | null = null;

export function getPropPreferencePersister(): PropPreferencePersister {
	if (!browser) throw new Error('getPropPreferencePersister() is browser-only');
	return instance ??= new PropPreferencePersister();
}
