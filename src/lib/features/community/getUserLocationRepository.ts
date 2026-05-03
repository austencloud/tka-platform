import { browser } from '$app/environment';
import { UserLocationRepository } from './services/implementations/UserLocationRepository';

let instance: UserLocationRepository | null = null;

export function getUserLocationRepository(): UserLocationRepository {
	if (!browser) throw new Error('getUserLocationRepository() is browser-only');
	return instance ??= new UserLocationRepository();
}
