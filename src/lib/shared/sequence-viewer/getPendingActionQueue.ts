import { browser } from '$app/environment';
import { PendingActionQueue } from './services/implementations/PendingActionQueue';

let instance: PendingActionQueue | null = null;

export function getPendingActionQueue(): PendingActionQueue {
	if (!browser) throw new Error('getPendingActionQueue() is browser-only');
	return instance ??= new PendingActionQueue();
}
