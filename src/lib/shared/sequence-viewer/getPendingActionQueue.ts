import { browser } from '$app/environment';
import type { IPendingActionQueue } from './services/contracts/IPendingActionQueue';
import { PendingActionQueue } from './services/implementations/PendingActionQueue';

let instance: IPendingActionQueue | null = null;

export function getPendingActionQueue(): IPendingActionQueue {
	if (!browser) throw new Error('getPendingActionQueue() is browser-only');
	return instance ??= new PendingActionQueue();
}
