import { browser } from '$app/environment';
import type { ITextRenderer } from './services/contracts/ITextRenderer';
import { TextRenderer } from './services/implementations/TextRenderer';
import { getDimensionCalculator } from './getDimensionCalculator';
import { getLoopIconStripRenderer } from './getLoopIconStripRenderer';

let instance: ITextRenderer | null = null;

export function getTextRenderer(): ITextRenderer {
	if (!browser) throw new Error('getTextRenderer() is browser-only');
	return instance ??= new TextRenderer(
		getDimensionCalculator(),
		getLoopIconStripRenderer()
	);
}
