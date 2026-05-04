import { browser } from '$app/environment';
import { OptionFilter } from './services/implementations/OptionFilter';
import { getPositionAnalyzer } from './getPositionAnalyzer';

let instance: OptionFilter | null = null;

export function getOptionFilter(): OptionFilter {
	if (!browser) throw new Error('getOptionFilter() is browser-only');
	return instance ??= new OptionFilter(getPositionAnalyzer());
}
