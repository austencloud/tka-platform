import { browser } from '$app/environment';
import type { IHandStateAnalyzer } from './services/contracts/IHandStateAnalyzer';
import { HandStateAnalyzer } from './services/implementations/HandStateAnalyzer';

let instance: IHandStateAnalyzer | null = null;

export function getHandStateAnalyzer(): IHandStateAnalyzer {
	if (!browser) throw new Error('getHandStateAnalyzer() is browser-only');
	return instance ??= new HandStateAnalyzer();
}
