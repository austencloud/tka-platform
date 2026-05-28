import { HapticFeedback } from './services/implementations/HapticFeedback';

let instance: HapticFeedback | null = null;

export function getHapticFeedback(): HapticFeedback {
	return instance ??= new HapticFeedback();
}
