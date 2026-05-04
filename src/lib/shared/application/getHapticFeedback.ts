import { browser } from '$app/environment';
import { HapticFeedback } from './services/implementations/HapticFeedback';

let instance: HapticFeedback | null = null;

export function getHapticFeedback(): HapticFeedback {
	if (!browser) throw new Error('getHapticFeedback() is browser-only');
	return instance ??= new HapticFeedback();
}
