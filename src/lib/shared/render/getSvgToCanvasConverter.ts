import { browser } from '$app/environment';
import type { ISVGToCanvasConverter } from './services/contracts/ISVGToCanvasConverter';
import { SVGToCanvasConverter } from './services/implementations/SVGToCanvasConverter';

let instance: ISVGToCanvasConverter | null = null;

export function getSvgToCanvasConverter(): ISVGToCanvasConverter {
	if (!browser) throw new Error('getSvgToCanvasConverter() is browser-only');
	return instance ??= new SVGToCanvasConverter();
}
