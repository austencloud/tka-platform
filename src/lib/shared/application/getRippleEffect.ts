import { browser } from '$app/environment';
import { RippleEffect } from './services/implementations/RippleEffect';

let instance: RippleEffect | null = null;

export function getRippleEffect(): RippleEffect {
	if (!browser) throw new Error('getRippleEffect() is browser-only');
	return instance ??= new RippleEffect();
}
