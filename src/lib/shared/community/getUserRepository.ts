import { browser } from '$app/environment';
import { UserRepository } from './services/implementations/UserRepository';

let instance: UserRepository | null = null;

export function getUserRepository(): UserRepository {
	if (!browser) throw new Error('getUserRepository() is browser-only');
	return instance ??= new UserRepository();
}
