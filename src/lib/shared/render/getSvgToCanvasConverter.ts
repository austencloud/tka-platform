import { browser } from '$app/environment';
import { SVGToCanvasConverter } from './services/implementations/SVGToCanvasConverter';

let instance: SVGToCanvasConverter | null = null;

export function getSvgToCanvasConverter(): SVGToCanvasConverter {
	if (!browser) throw new Error('getSvgToCanvasConverter() is browser-only');
	return instance ??= new SVGToCanvasConverter();
}
