import { browser } from '$app/environment';

import { UserActivityTracker } from './services/UserActivityTracker';
import { getPresenceTracker } from '$lib/shared/presence/getPresenceTracker';

let instance: UserActivityTracker | null = null;

export function getUserActivityTracker(): UserActivityTracker {
	if (!browser) throw new Error('getUserActivityTracker() is browser-only');
	return instance ??= new UserActivityTracker(getPresenceTracker());
}
