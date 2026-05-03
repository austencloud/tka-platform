import { browser } from '$app/environment';
import { OptionSorter } from './services/implementations/OptionSorter';
import { getReversalChecker } from './getReversalChecker';
import { getPositionAnalyzer } from './getPositionAnalyzer';

let instance: OptionSorter | null = null;

export function getOptionSorter(): OptionSorter {
	if (!browser) throw new Error('getOptionSorter() is browser-only');
	return instance ??= new OptionSorter(getReversalChecker(), getPositionAnalyzer());
}
