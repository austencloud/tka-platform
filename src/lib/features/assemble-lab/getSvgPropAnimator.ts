import { browser } from '$app/environment';

import { SvgPropAnimator } from './services/SvgPropAnimator';

let instance: SvgPropAnimator | null = null;

export function getSvgPropAnimator(): SvgPropAnimator {
	if (!browser) throw new Error('getSvgPropAnimator() is browser-only');
	return instance ??= new SvgPropAnimator();
}
