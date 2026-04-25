import { browser } from '$app/environment';
import type { IOptionSorter } from './services/contracts/IOptionSorter';
import { OptionSorter } from './services/implementations/OptionSorter';
import { getReversalChecker } from './getReversalChecker';
import { getPositionAnalyzer } from './getPositionAnalyzer';

let instance: IOptionSorter | null = null;

export function getOptionSorter(): IOptionSorter {
	if (!browser) throw new Error('getOptionSorter() is browser-only');
	return instance ??= new OptionSorter(getReversalChecker(), getPositionAnalyzer());
}
