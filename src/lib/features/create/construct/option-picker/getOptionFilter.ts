import { browser } from '$app/environment';
import { OptionFilter } from './services/implementations/OptionFilter';
import { getReversalChecker } from './getReversalChecker';
import { getPositionAnalyzer } from './getPositionAnalyzer';

let instance: OptionFilter | null = null;

export function getOptionFilter(): OptionFilter {
	if (!browser) throw new Error('getOptionFilter() is browser-only');
	return instance ??= new OptionFilter(getReversalChecker(), getPositionAnalyzer());
}
