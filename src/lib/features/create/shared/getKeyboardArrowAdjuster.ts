import { browser } from '$app/environment';
import { KeyboardArrowAdjuster } from './services/implementations/KeyboardArrowAdjuster';

let instance: KeyboardArrowAdjuster | null = null;

export function getKeyboardArrowAdjuster(): KeyboardArrowAdjuster {
	if (!browser) throw new Error('getKeyboardArrowAdjuster() is browser-only');
	return instance ??= new KeyboardArrowAdjuster();
}
