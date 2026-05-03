import { browser } from '$app/environment';
import { QuickAccessPersister } from './services/implementations/QuickAccessPersister';

let instance: QuickAccessPersister | null = null;

export function getQuickAccessPersister(): QuickAccessPersister {
	if (!browser) throw new Error('getQuickAccessPersister() is browser-only');
	return instance ??= new QuickAccessPersister();
}
