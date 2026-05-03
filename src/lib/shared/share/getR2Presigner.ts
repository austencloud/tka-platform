import { browser } from '$app/environment';
import { R2Presigner } from './services/implementations/R2Presigner';

let instance: R2Presigner | null = null;

export function getR2Presigner(): R2Presigner {
	if (!browser) throw new Error('getR2Presigner() is browser-only');
	return instance ??= new R2Presigner();
}
