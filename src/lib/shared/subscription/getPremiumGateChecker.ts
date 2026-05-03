import { browser } from '$app/environment';
import { PremiumGateChecker } from './services/implementations/PremiumGateChecker';

let instance: PremiumGateChecker | null = null;

export function getPremiumGateChecker(): PremiumGateChecker {
	if (!browser) throw new Error('getPremiumGateChecker() is browser-only');
	return instance ??= new PremiumGateChecker();
}
