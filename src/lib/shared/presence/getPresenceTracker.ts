import { browser } from '$app/environment';
import type { IPresenceTracker } from './services/contracts/IPresenceTracker';
import { PresenceTracker } from './services/implementations/PresenceTracker';

let instance: IPresenceTracker | null = null;

export function getPresenceTracker(): IPresenceTracker {
	if (!browser) throw new Error('getPresenceTracker() is browser-only');
	return instance ??= new PresenceTracker();
}
