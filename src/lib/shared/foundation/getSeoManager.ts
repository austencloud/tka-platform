import { browser } from '$app/environment';
import { SeoManager } from './services/implementations/SeoManager';

let instance: SeoManager | null = null;

export function getSeoManager(): SeoManager {
	if (!browser) throw new Error('getSeoManager() is browser-only');
	return instance ??= new SeoManager();
}
