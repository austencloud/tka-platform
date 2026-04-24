import { browser } from '$app/environment';
import type { IPWAInstallDismissalManager } from './services/contracts/IPWAInstallDismissalManager';
import { PWAInstallDismissalManager } from './services/implementations/PWAInstallDismissalManager';

let instance: IPWAInstallDismissalManager | null = null;

export function getPWAInstallDismissalManager(): IPWAInstallDismissalManager {
	if (!browser) throw new Error('getPWAInstallDismissalManager() is browser-only');
	return instance ??= new PWAInstallDismissalManager();
}
