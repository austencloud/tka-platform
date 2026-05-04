import { browser } from '$app/environment';
import * as handednessAnalyzer from './services/handedness-analyzer';

export function getHandednessAnalyzer() {
	if (!browser) throw new Error('getHandednessAnalyzer() is browser-only');
	return handednessAnalyzer;
}
