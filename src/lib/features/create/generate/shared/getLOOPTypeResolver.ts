import { browser } from '$app/environment';
import type { ILOOPTypeResolver } from './services/contracts/ILOOPTypeResolver';
import { LOOPTypeResolver } from './services/implementations/LOOPTypeResolver';

let instance: ILOOPTypeResolver | null = null;

export function getLOOPTypeResolver(): ILOOPTypeResolver {
	if (!browser) throw new Error('getLOOPTypeResolver() is browser-only');
	return instance ??= new LOOPTypeResolver();
}
