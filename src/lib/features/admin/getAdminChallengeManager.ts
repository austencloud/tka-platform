import { browser } from '$app/environment';

import { AdminChallengeManager } from './services/implementations/AdminChallengeManager';

let instance: AdminChallengeManager | null = null;

export function getAdminChallengeManager(): AdminChallengeManager {
	if (!browser) throw new Error('getAdminChallengeManager() is browser-only');
	return instance ??= new AdminChallengeManager();
}
