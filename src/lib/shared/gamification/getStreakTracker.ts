import { browser } from '$app/environment';
import type { IStreakTracker } from './services/contracts/IStreakTracker';
import { StreakTracker } from './services/implementations/StreakTracker';

let instance: IStreakTracker | null = null;

export function getStreakTracker(): IStreakTracker {
	if (!browser) throw new Error('getStreakTracker() is browser-only');
	return instance ??= new StreakTracker();
}
