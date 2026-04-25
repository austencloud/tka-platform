import { browser } from '$app/environment';
import type { ISwapInvertComparer } from './services/contracts/ISwapInvertComparer';
import { SwapInvertComparer } from './services/implementations/comparison/SwapInvertComparer';

let instance: ISwapInvertComparer | null = null;

export function getSwapInvertComparer(): ISwapInvertComparer {
	if (!browser) throw new Error('getSwapInvertComparer() is browser-only');
	return instance ??= new SwapInvertComparer();
}
