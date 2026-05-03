import { browser } from '$app/environment';
import { SectionTitleFormatter } from './services/implementations/SectionTitleFormatter';

let instance: SectionTitleFormatter | null = null;

export function getSectionTitleFormatter(): SectionTitleFormatter {
	if (!browser) throw new Error('getSectionTitleFormatter() is browser-only');
	return instance ??= new SectionTitleFormatter();
}
