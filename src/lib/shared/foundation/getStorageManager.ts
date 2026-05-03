import { browser } from '$app/environment';

import { StorageManager } from './services/implementations/StorageManager';

let instance: StorageManager | null = null;

export function getStorageManager(): StorageManager {
	if (!browser) throw new Error('getStorageManager() is browser-only');
	return instance ??= new StorageManager();
}
