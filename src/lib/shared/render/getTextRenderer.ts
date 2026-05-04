import { browser } from '$app/environment';
import { TextRenderer } from './services/implementations/TextRenderer';

let instance: TextRenderer | null = null;

export function getTextRenderer(): TextRenderer {
	if (!browser) throw new Error('getTextRenderer() is browser-only');
	return instance ??= new TextRenderer();
}
