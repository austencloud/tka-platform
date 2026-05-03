import { browser } from '$app/environment';
import { PWAInstallDismissalManager } from './services/implementations/PWAInstallDismissalManager';

let instance: PWAInstallDismissalManager | null = null;

export function getPWAInstallDismissalManager(): PWAInstallDismissalManager {
	if (!browser) throw new Error('getPWAInstallDismissalManager() is browser-only');
	return instance ??= new PWAInstallDismissalManager();
}
