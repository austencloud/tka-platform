import { browser } from '$app/environment';
import type { ITypographyScaler } from './services/contracts/ITypographyScaler';
import { TypographyScaler } from './services/implementations/TypographyScaler';

let instance: ITypographyScaler | null = null;

export function getTypographyScaler(): ITypographyScaler {
	if (!browser) throw new Error('getTypographyScaler() is browser-only');
	return instance ??= new TypographyScaler();
}
