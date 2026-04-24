import { browser } from '$app/environment';
import type { ISubscriptionManager } from './services/contracts/ISubscriptionManager';
import { SubscriptionManager } from './services/implementations/SubscriptionManager';

let instance: ISubscriptionManager | null = null;

export function getSubscriptionManager(): ISubscriptionManager {
	if (!browser) throw new Error('getSubscriptionManager() is browser-only');
	return instance ??= new SubscriptionManager();
}
