import { browser } from '$app/environment';
import { OptionFilter } from './services/option-filter';
import { getPositionAnalyzer } from './get-position-analyzer';

let instance: OptionFilter | null = null;

export function getOptionFilter(): OptionFilter {
	if (!browser) throw new Error('getOptionFilter() is browser-only');
	return instance ??= new OptionFilter(getPositionAnalyzer());
}
