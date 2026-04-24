import { browser } from '$app/environment';
import type { IHapticFeedback } from './services/contracts/IHapticFeedback';
import { HapticFeedback } from './services/implementations/HapticFeedback';
import { getNativePlatformDetector } from '../platform/getNativePlatformDetector';

let instance: IHapticFeedback | null = null;

export function getHapticFeedback(): IHapticFeedback {
	if (!browser) throw new Error('getHapticFeedback() is browser-only');
	return instance ??= new HapticFeedback(getNativePlatformDetector());
}
