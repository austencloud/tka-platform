import { browser } from '$app/environment';
import { FuseAssemblyAnimator } from './services/implementations/FuseAssemblyAnimator';

let instance: FuseAssemblyAnimator | null = null;

export function getFuseAssemblyAnimator(): FuseAssemblyAnimator {
	if (!browser) throw new Error('getFuseAssemblyAnimator() is browser-only');
	return instance ??= new FuseAssemblyAnimator();
}
