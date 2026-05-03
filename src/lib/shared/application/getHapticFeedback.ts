import { browser } from '$app/environment';
import { HapticFeedback } from './services/implementations/HapticFeedback';
import { getNativePlatformDetector } from '../platform/getNativePlatformDetector';

let instance: HapticFeedback | null = null;

export function getHapticFeedback(): HapticFeedback {
	if (!browser) throw new Error('getHapticFeedback() is browser-only');
	return instance ??= new HapticFeedback(getNativePlatformDetector());
}
