import { browser } from '$app/environment';
import type { ILeaderboardManager } from './services/contracts/ILeaderboardManager';
import { LeaderboardManager } from './services/implementations/LeaderboardManager';

let instance: ILeaderboardManager | null = null;

export function getLeaderboardManager(): ILeaderboardManager {
	if (!browser) throw new Error('getLeaderboardManager() is browser-only');
	return instance ??= new LeaderboardManager();
}
