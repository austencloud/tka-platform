import { browser } from '$app/environment';
import type { IAdminChallengeManager } from './services/contracts/IAdminChallengeManager';
import { AdminChallengeManager } from './services/implementations/AdminChallengeManager';
import { getAuditLogger } from './getAuditLogger';

let instance: IAdminChallengeManager | null = null;

export function getAdminChallengeManager(): IAdminChallengeManager {
	if (!browser) throw new Error('getAdminChallengeManager() is browser-only');
	return instance ??= new AdminChallengeManager(getAuditLogger());
}
