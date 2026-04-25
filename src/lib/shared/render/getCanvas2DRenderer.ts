import { browser } from '$app/environment';
import type { IDirectRenderer } from './services/contracts/IDirectRenderer';
import { Canvas2DDirectRenderer } from './services/implementations/Canvas2DDirectRenderer';

let instance: IDirectRenderer | null = null;

export function getCanvas2DRenderer(): IDirectRenderer {
	if (!browser) throw new Error('getCanvas2DRenderer() is browser-only');
	return instance ??= new Canvas2DDirectRenderer();
}
