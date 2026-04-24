import { browser } from '$app/environment';
import type { ISeoManager } from './services/contracts/ISeoManager';
import { SeoManager } from './services/implementations/SeoManager';

let instance: ISeoManager | null = null;

export function getSeoManager(): ISeoManager {
	if (!browser) throw new Error('getSeoManager() is browser-only');
	return instance ??= new SeoManager();
}
