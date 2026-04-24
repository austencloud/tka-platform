import { browser } from '$app/environment';
import type { IGlobalFeatureFlagPersister } from './services/contracts/IGlobalFeatureFlagPersister';
import { GlobalFeatureFlagPersister } from './services/implementations/GlobalFeatureFlagPersister';

let instance: IGlobalFeatureFlagPersister | null = null;

export function getGlobalFeatureFlagPersister(): IGlobalFeatureFlagPersister {
	if (!browser) throw new Error('getGlobalFeatureFlagPersister() is browser-only');
	return instance ??= new GlobalFeatureFlagPersister();
}
