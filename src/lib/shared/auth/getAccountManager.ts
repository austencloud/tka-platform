import { browser } from '$app/environment';
import type { IAccountManager } from './services/contracts/IAccountManager';
import { AccountManager } from './services/implementations/AccountManager';
import { getHapticFeedback } from '../application/getHapticFeedback';

let instance: IAccountManager | null = null;

export function getAccountManager(): IAccountManager {
	if (!browser) throw new Error('getAccountManager() is browser-only');
	return instance ??= new AccountManager(getHapticFeedback());
}
