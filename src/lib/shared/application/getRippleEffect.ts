import { browser } from '$app/environment';
import type { IRippleEffect } from './services/contracts/IRippleEffect';
import { RippleEffect } from './services/implementations/RippleEffect';

let instance: IRippleEffect | null = null;

export function getRippleEffect(): IRippleEffect {
	if (!browser) throw new Error('getRippleEffect() is browser-only');
	return instance ??= new RippleEffect();
}
