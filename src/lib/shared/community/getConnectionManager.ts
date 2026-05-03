import { browser } from '$app/environment';
import { ConnectionManager } from './services/implementations/ConnectionManager';

let instance: ConnectionManager | null = null;

export function getConnectionManager(): ConnectionManager {
	if (!browser) throw new Error('getConnectionManager() is browser-only');
	return instance ??= new ConnectionManager();
}
