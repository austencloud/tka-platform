import { browser } from '$app/environment';
import type { ISvgPropAnimator } from './services/contracts/ISvgPropAnimator';
import { SvgPropAnimator } from './services/implementations/SvgPropAnimator';

let instance: ISvgPropAnimator | null = null;

export function getSvgPropAnimator(): ISvgPropAnimator {
	if (!browser) throw new Error('getSvgPropAnimator() is browser-only');
	return instance ??= new SvgPropAnimator();
}
