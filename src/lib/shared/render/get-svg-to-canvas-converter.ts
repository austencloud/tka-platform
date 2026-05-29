import { browser } from '$app/environment';
import { SVGToCanvasConverter } from './services/svg-to-canvas-converter';

let instance: SVGToCanvasConverter | null = null;

export function getSvgToCanvasConverter(): SVGToCanvasConverter {
	if (!browser) throw new Error('getSvgToCanvasConverter() is browser-only');
	return instance ??= new SVGToCanvasConverter();
}
