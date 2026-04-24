import { browser } from '$app/environment';
import type { IStorageManager } from './services/contracts/IStorageManager';
import { StorageManager } from './services/implementations/StorageManager';

let instance: IStorageManager | null = null;

export function getStorageManager(): IStorageManager {
	if (!browser) throw new Error('getStorageManager() is browser-only');
	return instance ??= new StorageManager();
}
