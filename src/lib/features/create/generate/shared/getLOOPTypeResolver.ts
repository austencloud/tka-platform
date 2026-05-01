import { browser } from '$app/environment';
import { LOOPTypeResolver } from './services/implementations/LOOPTypeResolver';

let instance: LOOPTypeResolver | null = null;

export function getLOOPTypeResolver(): LOOPTypeResolver {
	if (!browser) throw new Error('getLOOPTypeResolver() is browser-only');
	return instance ??= new LOOPTypeResolver();
}
