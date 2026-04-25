import { browser } from '$app/environment';
import type { ILayoutCalculator } from './services/contracts/ILayoutCalculator';
import { LayoutCalculator } from './services/implementations/LayoutCalculator';

let instance: ILayoutCalculator | null = null;

export function getLayoutCalculator(): ILayoutCalculator {
	if (!browser) throw new Error('getLayoutCalculator() is browser-only');
	return instance ??= new LayoutCalculator();
}
