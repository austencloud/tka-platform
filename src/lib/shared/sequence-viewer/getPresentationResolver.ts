import { browser } from '$app/environment';
import type { IPresentationResolver } from './services/contracts/IPresentationResolver';
import { PresentationResolver } from './services/implementations/PresentationResolver';

let instance: IPresentationResolver | null = null;

export function getPresentationResolver(): IPresentationResolver {
	if (!browser) throw new Error('getPresentationResolver() is browser-only');
	return instance ??= new PresentationResolver();
}
