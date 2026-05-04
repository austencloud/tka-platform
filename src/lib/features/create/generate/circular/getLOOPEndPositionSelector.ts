import { browser } from '$app/environment';
import { LOOPEndPositionSelector } from './services/implementations/LOOPEndPositionSelector';

let instance: LOOPEndPositionSelector | null = null;

export function getLOOPEndPositionSelector(): LOOPEndPositionSelector {
	if (!browser) throw new Error('getLOOPEndPositionSelector() is browser-only');
	return instance ??= new LOOPEndPositionSelector();
}
