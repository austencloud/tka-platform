import { browser } from '$app/environment';
import { ActManager } from './services/act-manager';

let instance: ActManager | null = null;

export function getActManager(): ActManager {
	if (!browser) throw new Error('getActManager() is browser-only');
	return instance ??= new ActManager();
}
