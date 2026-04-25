import { browser } from '$app/environment';
import type { IQuickAccessPersister } from './services/contracts/IQuickAccessPersister';
import { QuickAccessPersister } from './services/implementations/QuickAccessPersister';

let instance: IQuickAccessPersister | null = null;

export function getQuickAccessPersister(): IQuickAccessPersister {
	if (!browser) throw new Error('getQuickAccessPersister() is browser-only');
	return instance ??= new QuickAccessPersister();
}
