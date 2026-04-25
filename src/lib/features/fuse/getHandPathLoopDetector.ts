import { browser } from '$app/environment';
import type { IHandPathLoopDetector } from './services/contracts/IHandPathLoopDetector';
import { HandPathLoopDetector } from './services/implementations/HandPathLoopDetector';

let instance: IHandPathLoopDetector | null = null;

export function getHandPathLoopDetector(): IHandPathLoopDetector {
	if (!browser) throw new Error('getHandPathLoopDetector() is browser-only');
	return instance ??= new HandPathLoopDetector();
}
