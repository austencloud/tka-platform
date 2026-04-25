import { browser } from '$app/environment';
import type { ILOOPDetector } from './services/contracts/ILOOPDetector';
import { LOOPDetector } from './services/implementations/LOOPDetector';
import { getSequenceLoopabilityChecker } from '$lib/features/compose/getSequenceLoopabilityChecker';
import { getLOOPTypeResolver } from '$lib/features/create/generate/shared/getLOOPTypeResolver';

let instance: ILOOPDetector | null = null;

export function getLOOPDetector(): ILOOPDetector {
	if (!browser) throw new Error('getLOOPDetector() is browser-only');
	return instance ??= new LOOPDetector(getSequenceLoopabilityChecker(), getLOOPTypeResolver());
}
