import { HapticFeedback } from './services/haptic-feedback';

let instance: HapticFeedback | null = null;

export function getHapticFeedback(): HapticFeedback {
	return instance ??= new HapticFeedback();
}
