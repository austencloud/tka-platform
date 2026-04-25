import { browser } from '$app/environment';
import type { IUserSearcher } from './services/contracts/IUserSearcher';
import { UserSearcher } from './services/implementations/UserSearcher';

let instance: IUserSearcher | null = null;

export function getUserSearcher(): IUserSearcher {
	if (!browser) throw new Error('getUserSearcher() is browser-only');
	return instance ??= new UserSearcher();
}
