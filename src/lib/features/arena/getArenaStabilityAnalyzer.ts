import { browser } from '$app/environment';
import type { IStabilityAnalyzer } from './services/contracts/IStabilityAnalyzer';
import { StabilityAnalyzer } from './services/implementations/StabilityAnalyzer';

let instance: IStabilityAnalyzer | null = null;

export function getArenaStabilityAnalyzer(): IStabilityAnalyzer {
	if (!browser) throw new Error('getArenaStabilityAnalyzer() is browser-only');
	return instance ??= new StabilityAnalyzer();
}
