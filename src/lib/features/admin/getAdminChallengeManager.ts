import { browser } from '$app/environment';

import { AdminChallengeManager } from './services/implementations/AdminChallengeManager';
import { getAuditLogger } from './getAuditLogger';

let instance: AdminChallengeManager | null = null;

export function getAdminChallengeManager(): AdminChallengeManager {
	if (!browser) throw new Error('getAdminChallengeManager() is browser-only');
	return instance ??= new AdminChallengeManager(getAuditLogger());
}
