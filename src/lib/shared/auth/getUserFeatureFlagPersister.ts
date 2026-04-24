import { browser } from '$app/environment';
import type { IUserFeatureFlagPersister } from './services/contracts/IUserFeatureFlagPersister';
import { UserFeatureFlagPersister } from './services/implementations/UserFeatureFlagPersister';

let instance: IUserFeatureFlagPersister | null = null;

export function getUserFeatureFlagPersister(): IUserFeatureFlagPersister {
	if (!browser) throw new Error('getUserFeatureFlagPersister() is browser-only');
	return instance ??= new UserFeatureFlagPersister();
}
