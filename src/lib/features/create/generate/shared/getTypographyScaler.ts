import { browser } from '$app/environment';
import { TypographyScaler } from './services/implementations/TypographyScaler';

let instance: TypographyScaler | null = null;

export function getTypographyScaler(): TypographyScaler {
	if (!browser) throw new Error('getTypographyScaler() is browser-only');
	return instance ??= new TypographyScaler();
}
