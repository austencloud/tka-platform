import { browser } from '$app/environment';
import type { IKeyboardArrowAdjuster } from './services/contracts/IKeyboardArrowAdjuster';
import { KeyboardArrowAdjuster } from './services/implementations/KeyboardArrowAdjuster';

let instance: IKeyboardArrowAdjuster | null = null;

export function getKeyboardArrowAdjuster(): IKeyboardArrowAdjuster {
	if (!browser) throw new Error('getKeyboardArrowAdjuster() is browser-only');
	return instance ??= new KeyboardArrowAdjuster();
}
