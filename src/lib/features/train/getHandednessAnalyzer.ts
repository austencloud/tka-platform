import { browser } from '$app/environment';
import type { IHandednessAnalyzer } from './services/contracts/IHandednessAnalyzer';
import { HandednessAnalyzer } from './services/implementations/HandednessAnalyzer';

let instance: IHandednessAnalyzer | null = null;

export function getHandednessAnalyzer(): IHandednessAnalyzer {
	if (!browser) throw new Error('getHandednessAnalyzer() is browser-only');
	return instance ??= new HandednessAnalyzer();
}
