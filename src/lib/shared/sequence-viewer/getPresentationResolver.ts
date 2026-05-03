import { browser } from '$app/environment';
import { PresentationResolver } from './services/implementations/PresentationResolver';

let instance: PresentationResolver | null = null;

export function getPresentationResolver(): PresentationResolver {
	if (!browser) throw new Error('getPresentationResolver() is browser-only');
	return instance ??= new PresentationResolver();
}
