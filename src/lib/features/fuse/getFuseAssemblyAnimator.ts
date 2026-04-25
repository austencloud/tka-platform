import { browser } from '$app/environment';
import type { IFuseAssemblyAnimator } from './services/contracts/IFuseAssemblyAnimator';
import { FuseAssemblyAnimator } from './services/implementations/FuseAssemblyAnimator';

let instance: IFuseAssemblyAnimator | null = null;

export function getFuseAssemblyAnimator(): IFuseAssemblyAnimator {
	if (!browser) throw new Error('getFuseAssemblyAnimator() is browser-only');
	return instance ??= new FuseAssemblyAnimator();
}
