import { browser } from '$app/environment';
import type { IMandalaTransformer } from './services/contracts/IMandalaTransformer';
import { MandalaTransformer } from './services/implementations/MandalaTransformer';

let instance: IMandalaTransformer | null = null;

export function getMandalaTransformer(): IMandalaTransformer {
	if (!browser) throw new Error('getMandalaTransformer() is browser-only');
	return instance ??= new MandalaTransformer();
}
