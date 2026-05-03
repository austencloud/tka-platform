import { browser } from '$app/environment';
import { GlobalFeatureFlagPersister } from './services/implementations/GlobalFeatureFlagPersister';

let instance: GlobalFeatureFlagPersister | null = null;

export function getGlobalFeatureFlagPersister(): GlobalFeatureFlagPersister {
	if (!browser) throw new Error('getGlobalFeatureFlagPersister() is browser-only');
	return instance ??= new GlobalFeatureFlagPersister();
}
