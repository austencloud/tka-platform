import { browser } from '$app/environment';
import type { ISectionTitleFormatter } from './services/contracts/ISectionTitleFormatter';
import { SectionTitleFormatter } from './services/implementations/SectionTitleFormatter';

let instance: ISectionTitleFormatter | null = null;

export function getSectionTitleFormatter(): ISectionTitleFormatter {
	if (!browser) throw new Error('getSectionTitleFormatter() is browser-only');
	return instance ??= new SectionTitleFormatter();
}
