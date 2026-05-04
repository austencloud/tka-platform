import { browser } from '$app/environment';
import * as handStateAnalyzer from './services/hand-state-analyzer';

export function getHandStateAnalyzer() {
	if (!browser) throw new Error('getHandStateAnalyzer() is browser-only');
	return handStateAnalyzer;
}
