import { browser } from '$app/environment';
import type { IOptionGridFitCalculator } from './services/contracts/IGridFitCalculator';
import { OptionGridFitCalculator } from './services/implementations/OptionGridFitCalculator';

let instance: IOptionGridFitCalculator | null = null;

export function getOptionGridFitCalculator(): IOptionGridFitCalculator {
	if (!browser) throw new Error('getOptionGridFitCalculator() is browser-only');
	return instance ??= new OptionGridFitCalculator();
}
