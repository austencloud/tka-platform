import { browser } from '$app/environment';
import type { IActManager } from './services/contracts/IActManager';
import { ActManager } from './services/implementations/ActManager';

let instance: IActManager | null = null;

export function getActManager(): IActManager {
	if (!browser) throw new Error('getActManager() is browser-only');
	return instance ??= new ActManager();
}
