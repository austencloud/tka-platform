import { browser } from '$app/environment';
import { LayoutCalculator } from './services/implementations/LayoutCalculator';

let instance: LayoutCalculator | null = null;

export function getLayoutCalculator(): LayoutCalculator {
	if (!browser) throw new Error('getLayoutCalculator() is browser-only');
	return instance ??= new LayoutCalculator();
}
