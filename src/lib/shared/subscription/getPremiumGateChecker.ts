import { browser } from '$app/environment';
import type { IPremiumGateChecker } from './services/contracts/IPremiumGateChecker';
import { PremiumGateChecker } from './services/implementations/PremiumGateChecker';

let instance: IPremiumGateChecker | null = null;

export function getPremiumGateChecker(): IPremiumGateChecker {
	if (!browser) throw new Error('getPremiumGateChecker() is browser-only');
	return instance ??= new PremiumGateChecker();
}
