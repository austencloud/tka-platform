import { browser } from '$app/environment';

import { UserActivityTracker } from './services/user-activity-tracker';
import { getPresenceTracker } from '$lib/shared/presence/get-presence-tracker';

let instance: UserActivityTracker | null = null;

export function getUserActivityTracker(): UserActivityTracker {
	if (!browser) throw new Error('getUserActivityTracker() is browser-only');
	return instance ??= new UserActivityTracker(getPresenceTracker());
}
