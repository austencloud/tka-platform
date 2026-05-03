import { browser } from '$app/environment';
import { SubscriptionManager } from './services/implementations/SubscriptionManager';

let instance: SubscriptionManager | null = null;

export function getSubscriptionManager(): SubscriptionManager {
	if (!browser) throw new Error('getSubscriptionManager() is browser-only');
	return instance ??= new SubscriptionManager();
}
