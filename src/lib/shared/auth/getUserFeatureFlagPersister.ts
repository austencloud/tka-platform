import { browser } from '$app/environment';
import { UserFeatureFlagPersister } from './services/implementations/UserFeatureFlagPersister';

let instance: UserFeatureFlagPersister | null = null;

export function getUserFeatureFlagPersister(): UserFeatureFlagPersister {
	if (!browser) throw new Error('getUserFeatureFlagPersister() is browser-only');
	return instance ??= new UserFeatureFlagPersister();
}
