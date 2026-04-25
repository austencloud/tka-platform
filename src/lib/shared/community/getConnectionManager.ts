import { browser } from '$app/environment';
import type { IConnectionManager } from './services/contracts/IConnectionManager';
import { ConnectionManager } from './services/implementations/ConnectionManager';

let instance: IConnectionManager | null = null;

export function getConnectionManager(): IConnectionManager {
	if (!browser) throw new Error('getConnectionManager() is browser-only');
	return instance ??= new ConnectionManager();
}
