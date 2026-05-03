import { browser } from '$app/environment';
import { UserSearcher } from './services/implementations/UserSearcher';

let instance: UserSearcher | null = null;

export function getUserSearcher(): UserSearcher {
	if (!browser) throw new Error('getUserSearcher() is browser-only');
	return instance ??= new UserSearcher();
}
