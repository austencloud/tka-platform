import { browser } from '$app/environment';
import { typographyScaler } from './services/typography-scaler';

export function getTypographyScaler(): typeof typographyScaler {
	if (!browser) throw new Error('getTypographyScaler() is browser-only');
	return typographyScaler;
}
