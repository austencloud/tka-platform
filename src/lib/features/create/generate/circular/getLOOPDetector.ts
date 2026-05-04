import { browser } from '$app/environment';
import type { ILOOPDetector } from './services/contracts/ILOOPDetector';
import { LOOPDetector } from './services/implementations/LOOPDetector';

let instance: ILOOPDetector | null = null;

export function getLOOPDetector(): ILOOPDetector {
	if (!browser) throw new Error('getLOOPDetector() is browser-only');
	return instance ??= new LOOPDetector();
}
