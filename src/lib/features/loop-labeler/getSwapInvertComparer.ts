import { browser } from '$app/environment';
import { SwapInvertComparer } from './services/implementations/comparison/SwapInvertComparer';

let instance: SwapInvertComparer | null = null;

export function getSwapInvertComparer(): SwapInvertComparer {
	if (!browser) throw new Error('getSwapInvertComparer() is browser-only');
	return instance ??= new SwapInvertComparer();
}
