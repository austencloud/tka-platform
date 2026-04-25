import { browser } from '$app/environment';
import type { IUserLocationRepository } from './services/contracts/IUserLocationRepository';
import { UserLocationRepository } from './services/implementations/UserLocationRepository';

let instance: IUserLocationRepository | null = null;

export function getUserLocationRepository(): IUserLocationRepository {
	if (!browser) throw new Error('getUserLocationRepository() is browser-only');
	return instance ??= new UserLocationRepository();
}
