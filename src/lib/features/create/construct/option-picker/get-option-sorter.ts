import { browser } from '$app/environment';
import { OptionSorter } from './services/option-sorter';
import { getPositionAnalyzer } from './get-position-analyzer';

let instance: OptionSorter | null = null;

export function getOptionSorter(): OptionSorter {
	if (!browser) throw new Error('getOptionSorter() is browser-only');
	return instance ??= new OptionSorter(getPositionAnalyzer());
}
