import { browser } from '$app/environment';
import { LeaderboardManager } from './services/implementations/LeaderboardManager';

let instance: LeaderboardManager | null = null;

export function getLeaderboardManager(): LeaderboardManager {
	if (!browser) throw new Error('getLeaderboardManager() is browser-only');
	return instance ??= new LeaderboardManager();
}
