import { browser } from '$app/environment';
import type { IUserActivityTracker } from './services/contracts/IUserActivityTracker';
import { UserActivityTracker } from './services/implementations/UserActivityTracker';
import { getPresenceTracker } from '$lib/shared/presence/getPresenceTracker';

let instance: IUserActivityTracker | null = null;

export function getUserActivityTracker(): IUserActivityTracker {
	if (!browser) throw new Error('getUserActivityTracker() is browser-only');
	return instance ??= new UserActivityTracker(getPresenceTracker());
}
