import { browser } from '$app/environment';
import { TextRenderer } from './services/implementations/TextRenderer';
import { getDimensionCalculator } from './getDimensionCalculator';
import { getLoopIconStripRenderer } from './getLoopIconStripRenderer';

let instance: TextRenderer | null = null;

export function getTextRenderer(): TextRenderer {
	if (!browser) throw new Error('getTextRenderer() is browser-only');
	return instance ??= new TextRenderer(
		getDimensionCalculator(),
		getLoopIconStripRenderer()
	);
}
