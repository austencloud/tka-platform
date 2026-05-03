import { browser } from '$app/environment';

import { MandalaTransformer } from './services/implementations/MandalaTransformer';

let instance: MandalaTransformer | null = null;

export function getMandalaTransformer(): MandalaTransformer {
	if (!browser) throw new Error('getMandalaTransformer() is browser-only');
	return instance ??= new MandalaTransformer();
}
