import { browser } from '$app/environment';
import type { IUserRepository } from './services/contracts/IUserRepository';
import { UserRepository } from './services/implementations/UserRepository';

let instance: IUserRepository | null = null;

export function getUserRepository(): IUserRepository {
	if (!browser) throw new Error('getUserRepository() is browser-only');
	return instance ??= new UserRepository();
}
