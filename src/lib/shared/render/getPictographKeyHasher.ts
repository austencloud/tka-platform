import { browser } from '$app/environment';
import type { IPictographKeyHasher } from './services/contracts/IPictographKeyHasher';
import { PictographKeyHasher } from './services/implementations/PictographKeyHasher';

let instance: IPictographKeyHasher | null = null;

export function getPictographKeyHasher(): IPictographKeyHasher {
	if (!browser) throw new Error('getPictographKeyHasher() is browser-only');
	return instance ??= new PictographKeyHasher();
}
