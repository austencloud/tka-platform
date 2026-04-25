import { browser } from '$app/environment';
import type { IMandalaRenderer } from './services/contracts/IMandalaRenderer';
import { MandalaRenderer } from './services/implementations/MandalaRenderer';

let instance: IMandalaRenderer | null = null;

export function getMandalaRenderer(): IMandalaRenderer {
	if (!browser) throw new Error('getMandalaRenderer() is browser-only');
	return instance ??= new MandalaRenderer();
}
