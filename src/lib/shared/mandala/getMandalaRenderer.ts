import { browser } from '$app/environment';

import { MandalaRenderer } from './services/implementations/MandalaRenderer';

let instance: MandalaRenderer | null = null;

export function getMandalaRenderer(): MandalaRenderer {
	if (!browser) throw new Error('getMandalaRenderer() is browser-only');
	return instance ??= new MandalaRenderer();
}
