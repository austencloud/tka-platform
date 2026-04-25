import { browser } from '$app/environment';
import type { IR2Presigner } from './services/contracts/IR2Presigner';
import { R2Presigner } from './services/implementations/R2Presigner';

let instance: IR2Presigner | null = null;

export function getR2Presigner(): IR2Presigner {
	if (!browser) throw new Error('getR2Presigner() is browser-only');
	return instance ??= new R2Presigner();
}
