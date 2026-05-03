import { browser } from '$app/environment';
import { ArrowCollisionResolver } from './services/implementations/ArrowCollisionResolver';

let instance: ArrowCollisionResolver | null = null;

export function getArrowCollisionResolver(): ArrowCollisionResolver {
	if (!browser) throw new Error('getArrowCollisionResolver() is browser-only');
	return instance ??= new ArrowCollisionResolver();
}
