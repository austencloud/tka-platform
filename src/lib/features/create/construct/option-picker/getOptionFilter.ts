import { browser } from '$app/environment';
import type { IOptionFilter } from './services/contracts/IOptionFilter';
import { OptionFilter } from './services/implementations/OptionFilter';
import { getReversalChecker } from './getReversalChecker';
import { getPositionAnalyzer } from './getPositionAnalyzer';

let instance: IOptionFilter | null = null;

export function getOptionFilter(): IOptionFilter {
	if (!browser) throw new Error('getOptionFilter() is browser-only');
	return instance ??= new OptionFilter(getReversalChecker(), getPositionAnalyzer());
}
