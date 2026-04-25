import { browser } from '$app/environment';
import type { IArrowCollisionResolver } from './services/contracts/IArrowCollisionResolver';
import { ArrowCollisionResolver } from './services/implementations/ArrowCollisionResolver';

let instance: IArrowCollisionResolver | null = null;

export function getArrowCollisionResolver(): IArrowCollisionResolver {
	if (!browser) throw new Error('getArrowCollisionResolver() is browser-only');
	return instance ??= new ArrowCollisionResolver();
}
