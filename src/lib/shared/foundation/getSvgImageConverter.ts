import { browser } from '$app/environment';
import type { ISvgImageConverter } from './services/contracts/ISvgImageConverter';
import { SvgImageConverter } from './services/implementations/SvgImageConverter';

let instance: ISvgImageConverter | null = null;

export function getSvgImageConverter(): ISvgImageConverter {
	if (!browser) throw new Error('getSvgImageConverter() is browser-only');
	return instance ??= new SvgImageConverter();
}
